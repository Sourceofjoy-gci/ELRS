import re
import tiktoken
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass


@dataclass
class Chunk:
    content: str
    section_number: Optional[str] = None
    section_heading: Optional[str] = None
    part_heading: Optional[str] = None
    chapter_heading: Optional[str] = None
    token_count: int = 0
    metadata: Dict[str, Any] = None

    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


class EswatiniLegalChunker:
    PART_PATTERN = r"(?m)^(PART\s+[IVXLCDM\d]+)\s*[–—-]\s*(.+)$"
    CHAPTER_PATTERN = r"(?m)^(CHAPTER\s+\d+)\s*[–—-]\s*(.+)$"
    SECTION_PATTERN = r"(?m)^(\d+[A-Z]?)\.\s+([A-Z].+)$"
    SUBSECTION_PATTERN = r"(?m)^\((\d+|[a-z])\)\s+"

    CROSS_REFERENCE_PATTERN = r"(?:see|s\.\s*\d+|section\s+\d+)\s*(?:\(\d+\)|\(?[a-z]\)?)?"

    def __init__(
        self,
        max_tokens: int = 600,
        overlap_tokens: int = 150,
        encoding_model: str = "cl100k_base",
    ):
        self.max_tokens = max_tokens
        self.overlap_tokens = overlap_tokens
        try:
            self.encoder = tiktoken.get_encoding(encoding_model)
        except Exception:
            self.encoder = None

    def count_tokens(self, text: str) -> int:
        if self.encoder:
            return len(self.encoder.encode(text))
        return len(text) // 4

    def split_into_parts(self, text: str) -> List[Tuple[str, str]]:
        parts = []
        current_part_heading = None
        lines = text.split("\n")
        current_part_lines = []

        for line in lines:
            part_match = re.match(self.PART_PATTERN, line)
            if part_match:
                if current_part_lines:
                    parts.append((current_part_heading or "", "\n".join(current_part_lines)))
                current_part_heading = f"PART {part_match.group(1).replace('PART ', '')} — {part_match.group(2)}"
                current_part_lines = [line]
            else:
                current_part_lines.append(line)

        if current_part_lines:
            parts.append((current_part_heading or "", "\n".join(current_part_lines)))

        return parts

    def split_into_sections(self, text: str) -> List[Dict[str, Any]]:
        sections = []
        current_section_number = None
        current_section_heading = None
        lines = text.split("\n")
        current_section_lines = []

        for line in lines:
            section_match = re.match(self.SECTION_PATTERN, line)
            if section_match:
                if current_section_lines:
                    sections.append({
                        "number": current_section_number,
                        "heading": current_section_heading,
                        "lines": current_section_lines,
                    })
                current_section_number = section_match.group(1)
                current_section_heading = section_match.group(2)
                current_section_lines = [line]
            else:
                current_section_lines.append(line)

        if current_section_lines:
            sections.append({
                "number": current_section_number,
                "heading": current_section_heading,
                "lines": current_section_lines,
            })

        return sections

    def preserve_cross_references(self, text: str) -> str:
        sentences = re.split(r"(?<=[.!?])\s+", text)
        protected_sentences = []
        cross_ref_pattern = re.compile(self.CROSS_REFERENCE_PATTERN, re.IGNORECASE)

        for i, sentence in enumerate(sentences):
            if cross_ref_pattern.search(sentence) and i > 0:
                if len(sentence) < 200:
                    protected_sentences[-1] = protected_sentences[-1] + " " + sentence
                    continue
            protected_sentences.append(sentence)

        return " ".join(protected_sentences)

    def chunk_section(self, section: Dict[str, Any], part_heading: str, chapter_heading: str) -> List[Chunk]:
        content = "\n".join(section.get("lines", []))
        content = self.preserve_cross_references(content)
        token_count = self.count_tokens(content)

        if token_count <= self.max_tokens:
            return [Chunk(
                content=content,
                section_number=section.get("number"),
                section_heading=section.get("heading"),
                part_heading=part_heading,
                chapter_heading=chapter_heading,
                token_count=token_count,
            )]

        chunks = []
        subsections = self._split_into_subsections(content)

        current_chunk_lines = []
        current_chunk_tokens = 0

        for subsection in subsections:
            subsection_tokens = self.count_tokens(subsection)
            overlap_text = ""
            overlap_tokens = 0

            if current_chunk_tokens + subsection_tokens > self.max_tokens and current_chunk_lines:
                if overlap_tokens > 0 and len(current_chunk_lines) > 3:
                    overlap_text = " ".join(current_chunk_lines[-3:])
                    overlap_tokens = self.count_tokens(overlap_text)

                chunk_content = "\n".join(current_chunk_lines)
                chunk_content = self.preserve_cross_references(chunk_content)

                chunks.append(Chunk(
                    content=chunk_content,
                    section_number=section.get("number"),
                    section_heading=section.get("heading"),
                    part_heading=part_heading,
                    chapter_heading=chapter_heading,
                    token_count=current_chunk_tokens,
                ))

                current_chunk_lines = []
                if overlap_text:
                    current_chunk_lines = [overlap_text]
                    current_chunk_tokens = overlap_tokens
                else:
                    current_chunk_tokens = 0

            current_chunk_lines.append(subsection)
            current_chunk_tokens += subsection_tokens

        if current_chunk_lines:
            chunk_content = "\n".join(current_chunk_lines)
            chunk_content = self.preserve_cross_references(chunk_content)
            chunks.append(Chunk(
                content=chunk_content,
                section_number=section.get("number"),
                section_heading=section.get("heading"),
                part_heading=part_heading,
                chapter_heading=chapter_heading,
                token_count=current_chunk_tokens,
            ))

        return chunks

    def _split_into_subsections(self, text: str) -> List[str]:
        lines = text.split("\n")
        subsections = []
        current_subsection_lines = []
        current_subsection_match = None

        for line in lines:
            subsection_match = re.match(self.SUBSECTION_PATTERN, line)
            if subsection_match:
                if current_subsection_lines:
                    subsections.append("\n".join(current_subsection_lines))
                current_subsection_lines = [line]
                current_subsection_match = subsection_match
            else:
                if current_subsection_match and line.strip():
                    current_subsection_lines.append(line)
                elif not current_subsection_match:
                    current_subsection_lines.append(line)

        if current_subsection_lines:
            subsections.append("\n".join(current_subsection_lines))

        return subsections if subsections else [text]

    def chunk(self, text: str, document_metadata: Dict[str, Any]) -> List[Chunk]:
        all_chunks = []

        parts = self.split_into_parts(text)

        for part_heading, part_content in parts:
            sections = self.split_into_sections(part_content)

            for section in sections:
                section_chunks = self.chunk_section(section, part_heading, "")
                all_chunks.extend(section_chunks)

        if not all_chunks:
            all_chunks = self._fallback_chunking(text, document_metadata)

        for i, chunk in enumerate(all_chunks):
            chunk.metadata = {
                "act_name": document_metadata.get("title", ""),
                "act_number": document_metadata.get("act_number", ""),
                "year": document_metadata.get("year"),
                "doc_type": document_metadata.get("doc_type", "act"),
                "part_heading": chunk.part_heading,
                "section_number": chunk.section_number,
                "section_heading": chunk.section_heading,
                "chunk_index": i,
                "total_chunks": len(all_chunks),
                "token_count": chunk.token_count,
            }

        return all_chunks

    def _fallback_chunking(self, text: str, document_metadata: Dict[str, Any]) -> List[Chunk]:
        chunks = []
        tokens_per_char = 0.25
        estimated_chars = int(self.max_tokens / tokens_per_char)

        start = 0
        chunk_index = 0

        while start < len(text):
            end = min(start + estimated_chars, len(text))
            if end < len(text):
                break_point = text.rfind(". ", start, end)
                if break_point > start:
                    end = break_point + 2

            chunk_text = text[start:end].strip()
            if chunk_text:
                chunks.append(Chunk(
                    content=chunk_text,
                    token_count=self.count_tokens(chunk_text),
                ))

            start = end - int(self.overlap_tokens / tokens_per_char)
            if start <= 0:
                start = end
            chunk_index += 1

        return chunks
