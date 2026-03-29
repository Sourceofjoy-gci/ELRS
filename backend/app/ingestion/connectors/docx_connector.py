import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)


class DOCXConnector:
    HEADING_STYLES = [
        "Heading 1", "Heading 2", "Heading 3", "Heading 4",
        "heading 1", "heading 2", "heading 3", "heading 4",
        "Title", "Subtitle", "TOC Heading",
    ]

    def __init__(self):
        self.heading_hierarchy = []

    def extract_text(self, file_path: str) -> str:
        try:
            from docx import Document
        except ImportError:
            raise ImportError("python-docx is required for DOCX extraction. Install with: pip install python-docx")

        doc = Document(file_path)
        all_paragraphs = []

        for element in doc.element.body:
            if element.tag.endswith("p"):
                para = element
                style_name = self._get_style_name(para)
                text_parts = []

                for child in para:
                    if child.tag.endswith("t"):
                        if child.text:
                            text_parts.append(child.text)

                text = "".join(text_parts).strip()

                if style_name and any(h.lower() in style_name.lower() for h in ["heading", "title", "subtitle"]):
                    self.heading_hierarchy.append({
                        "style": style_name,
                        "text": text,
                        "level": self._get_heading_level(style_name),
                    })
                    all_paragraphs.append(f"\n{text}\n")
                elif text:
                    all_paragraphs.append(text)

            elif element.tag.endswith("tbl"):
                table_text = self._extract_table(element)
                if table_text:
                    all_paragraphs.append(f"\n{table_text}\n")

        return "\n\n".join(all_paragraphs)

    def _get_style_name(self, para) -> Optional[str]:
        pPr = para.find("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}pPr")
        if pPr is not None:
            pStyle = pPr.find("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}pStyle")
            if pStyle is not None:
                return pStyle.get("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val")
        return None

    def _get_heading_level(self, style_name: str) -> int:
        style_lower = style_name.lower()
        if "heading 1" in style_lower or style_lower == "title":
            return 1
        elif "heading 2" in style_lower or style_lower == "subtitle":
            return 2
        elif "heading 3" in style_lower:
            return 3
        elif "heading 4" in style_lower:
            return 4
        return 1

    def _extract_table(self, table_element) -> str:
        try:
            from docx.table import Table
            from docx.oxml.table import CT_Tbl
        except ImportError:
            return ""

        table = Table(table_element)
        rows_data = []

        for row in table.rows:
            cells = [cell.text.strip() for cell in row.cells]
            rows_data.append(" | ".join(cells))

        return "\n".join(rows_data)

    def get_heading_hierarchy(self) -> List[Dict[str, Any]]:
        return self.heading_hierarchy


def extract_docx_text(file_path: str) -> str:
    connector = DOCXConnector()
    return connector.extract_text(file_path)
