import re
from typing import Optional
import logging

logger = logging.getLogger(__name__)


class PDFConnector:
    PAGE_NUMBER_PATTERN = re.compile(r"^(Page\s+\d+\s+of\s+\d+|-\s*\d+\s*-|\d+\s*/\s*\d+)$")
    HEADER_FOOTER_THRESHOLD = 0.8

    def __init__(self):
        self.page_numbers_to_strip = set()
        self.header_footer_lines = set()

    def extract_text(self, file_path: str) -> str:
        try:
            import fitz
        except ImportError:
            raise ImportError("PyMuPDF (fitz) is required for PDF extraction. Install with: pip install pymupdf")

        doc = fitz.open(file_path)
        all_pages_text = []
        line_occurrences = {}

        for page_num in range(len(doc)):
            page = doc[page_num]
            blocks = page.get_text("blocks")

            for block in blocks:
                x0, y0, x1, y1, text, block_no, block_type = block
                lines = text.split("\n")

                for line in lines:
                    line = line.strip()
                    if line:
                        line_occurrences[line] = line_occurrences.get(line, 0) + 1

        for line, count in line_occurrences.items():
            if count >= len(doc) * self.HEADER_FOOTER_THRESHOLD:
                if self.PAGE_NUMBER_PATTERN.match(line):
                    self.page_numbers_to_strip.add(line)
                elif len(line) < 100:
                    self.header_footer_lines.add(line)

        for page_num in range(len(doc)):
            page = doc[page_num]
            blocks = page.get_text("blocks")
            page_lines = []

            for block in blocks:
                x0, y0, x1, y1, text, block_no, block_type = block
                lines = text.split("\n")

                for line in lines:
                    line = line.strip()
                    if not line:
                        continue

                    if line in self.page_numbers_to_strip:
                        continue

                    line = self._normalize_whitespace(line)
                    line = self._normalize_legal_numbering(line)

                    page_lines.append(line)

            if page_lines:
                all_pages_text.append("\n".join(page_lines))

        doc.close()
        return "\n\n".join(all_pages_text)

    def _normalize_whitespace(self, text: str) -> str:
        text = re.sub(r"\s+", " ", text)
        text = text.strip()
        return text

    def _normalize_legal_numbering(self, text: str) -> str:
        text = re.sub(r"(?<=\d)\s+(?=\([a-z0-9]\))", "", text)
        text = re.sub(r"(?<=\))\s+(?=[A-Z])", " ", text)
        return text


def extract_pdf_text(file_path: str) -> str:
    connector = PDFConnector()
    return connector.extract_text(file_path)
