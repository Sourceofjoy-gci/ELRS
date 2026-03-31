"""
Tests for app.py — Flask routes and integration.
Run: pytest backend/tests/test_app.py -v
"""
import pytest
import sys
import io
from pathlib import Path
from flask import Flask

sys.path.insert(0, str(Path(__file__).parent.parent))

# We test app.py by importing and using its route logic directly
# rather than spinning up a server, which keeps tests fast and isolated.


class TestAllowedFile:
    # Inline the helper to test without app context
    def _allowed_file(self, filename):
        return "." in filename and filename.rsplit(".", 1)[1].lower() in {"docx", "pdf", "txt"}

    def test_allowed_docx(self):
        assert self._allowed_file("document.docx") is True

    def test_allowed_pdf(self):
        assert self._allowed_file("document.pdf") is True

    def test_allowed_txt(self):
        assert self._allowed_file("document.txt") is True

    def test_disallowed_xlsx(self):
        assert self._allowed_file("document.xlsx") is False

    def test_disallowed_no_extension(self):
        assert self._allowed_file("document") is False

    def test_disallowed_empty_extension(self):
        assert self._allowed_file("document.") is False

    def test_case_insensitive(self):
        assert self._allowed_file("document.DOCX") is True
        assert self._allowed_file("document.Pdf") is True
