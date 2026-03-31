"""
ELRI Citation Verifier — Flask web server.
48-hour prototype: upload document → extract citations → verify against corpus → report.
"""

import sys
import os
from pathlib import Path
from flask import Flask, request, render_template_string, jsonify
from werkzeug.utils import secure_filename

# Local modules
from citation_extractor import extract_citations, verify_citations, normalize
from text_extractor import extract_text, EXTRACTION_ERROR

# ─── Config ───────────────────────────────────────────────────────────────────

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 1 * 1024 * 1024  # 1 MB cap

ALLOWED_EXTENSIONS = {"docx", "pdf", "txt"}
CORPUS_DB = Path(__file__).parent / "corpus.db"

# ─── Helpers ─────────────────────────────────────────────────────────────────

def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


HTML_TEMPLATE = """
<!doctype html>
<html>
<head>
  <title>ELRI — Citation Verifier</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 60px auto; padding: 0 20px; }
    h1 { color: #1a1a2e; }
    .upload { border: 2px dashed #ccc; padding: 40px; text-align: center; margin: 30px 0; border-radius: 8px; }
    input[type=file] { font-size: 16px; }
    input[type=submit] { background: #1a1a2e; color: white; border: none; padding: 12px 32px; font-size: 16px; border-radius: 4px; cursor: pointer; }
    .result { margin-top: 30px; }
    .citation { padding: 12px 16px; margin: 8px 0; border-radius: 4px; }
    .VALID { background: #d4edda; border-left: 4px solid #28a745; }
    .AMBER { background: #fff3cd; border-left: 4px solid #ffc107; }
    .NOT_FOUND { background: #f8d7da; border-left: 4px solid #dc3545; }
    .PARSE_ERROR { background: #f0f0f0; border-left: 4px solid #6c757d; }
    .citation-type { font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.05em; }
    .citation-raw { font-weight: 600; font-size: 16px; }
    .citation-msg { margin-top: 4px; font-size: 14px; color: #333; }
    .disclaimer { margin-top: 40px; font-size: 12px; color: #888; border-top: 1px solid #eee; padding-top: 16px; }
    .summary { font-size: 14px; color: #555; margin-bottom: 20px; }
    .parse-error-msg { color: #666; font-style: italic; }
  </style>
</head>
<body>
  <h1>ELRI Citation Verifier</h1>
  <p>Upload a legal document (.docx, .pdf, .txt) to extract and verify citations against the Eswatini legal corpus.</p>

  <div class="upload">
    <form method="post" enctype="multipart/form-data">
      <input type="file" name="document" accept=".docx,.pdf,.txt" required>
      <br><br>
      <input type="submit" value="Verify Citations">
    </form>
  </div>

  {% if error %}
    <div class="result">
      <div class="citation PARSE_ERROR">
        <div class="citation-type">Error</div>
        <div class="citation-raw">{{ error }}</div>
      </div>
    </div>
  {% endif %}

  {% if citations %}
    <div class="result">
      <div class="summary">
        Found <strong>{{ citations|length }}</strong> citation(s) &mdash;
        <span style="color:#28a745">VALID: {{ valid_count }}</span> &nbsp;
        <span style="color:#ffc107">AMBER: {{ amber_count }}</span> &nbsp;
        <span style="color:#dc3545">NOT FOUND: {{ not_found_count }}</span>
      </div>

      {% for c in citations %}
        <div class="citation {{ c.status }}">
          <div class="citation-type">{{ c.type }} &mdash; {{ c.status }}</div>
          <div class="citation-raw">{{ c.citation }}</div>
          <div class="citation-msg">{{ c.message }}</div>
        </div>
      {% endfor %}

      <div class="disclaimer">
        This verification is based on the available corpus and does not constitute legal advice.
        Users are responsible for independent verification of all citations.
      </div>
    </div>
  {% endif %}
</body>
</html>
"""


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.route("/", methods=["GET", "POST"])
def index():
    error = None
    citations = []
    valid_count = amber_count = not_found_count = 0

    if request.method == "POST":
        if "document" not in request.files:
            error = "No file provided."
        else:
            file = request.files["document"]
            if file.filename == "":
                error = "No file selected."
            elif not allowed_file(file.filename):
                error = f"Unsupported file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
            else:
                filename = secure_filename(file.filename)
                file_bytes = file.read()

                if len(file_bytes) == 0:
                    error = "File is empty."
                else:
                    text = extract_text(file_bytes, filename)

                    if text == EXTRACTION_ERROR:
                        error = f"Could not parse '{filename}' — unsupported format or corrupted file."
                    elif not text.strip():
                        error = f"'{filename}' produced no readable text."
                    else:
                        extracted = extract_citations(text)
                        if not extracted:
                            error = f"No citations found in '{filename}'."
                        else:
                            verified = verify_citations(extracted, str(CORPUS_DB))
                            citations = verified
                            for c in citations:
                                if c["status"] == "VALID":
                                    valid_count += 1
                                elif c["status"] == "AMBER":
                                    amber_count += 1
                                else:
                                    not_found_count += 1

    return render_template_string(
        HTML_TEMPLATE,
        error=error,
        citations=citations,
        valid_count=valid_count,
        amber_count=amber_count,
        not_found_count=not_found_count,
    )


if __name__ == "__main__":
    # Allow running directly: python app.py
    print("Starting ELRI Citation Verifier on http://127.0.0.1:5000")
    app.run(debug=True, host="127.0.0.1", port=5000)
