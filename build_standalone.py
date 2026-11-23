#!/usr/bin/env python3
"""
Builds a single, double-clickable standalone HTML file (kaya-sensei-go.html)
that runs offline on any Mac, Windows, or Linux computer without a local server.
"""

import re
import pathlib

ROOT = pathlib.Path(__file__).parent
OUT_FILE = ROOT / "kaya-sensei-go.html"

JS_ORDER = [
    "js/i18n.js",
    "js/engine.js",
    "js/nn-engine.js",
    "js/ai.js",
    "js/puzzles.js",
    "js/audio.js",
    "js/board-renderer.js",
    "js/app.js",
]

def strip_esm(code: str) -> str:
    # Remove multi-line and single-line import statements from local './...' modules
    code = re.sub(r"^\s*import\s+[\s\S]*?from\s+['\"]\./[^'\"]+['\"];?\s*$", "", code, flags=re.MULTILINE)
    # Remove 'export ' keyword before declarations
    code = re.sub(r"^(\s*)export\s+(?=(?:const|let|var|function|async\s+function|class)\b)", r"\1", code, flags=re.MULTILINE)
    return code

def main():
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    css = (ROOT / "styles.css").read_text(encoding="utf-8")

    bundled_js_parts = []
    for rel in JS_ORDER:
        src = (ROOT / rel).read_text(encoding="utf-8")
        cleaned = strip_esm(src)
        bundled_js_parts.append(f"// ===== {rel} =====\n{cleaned}")

    full_js = "(function() {\n'use strict';\n\n" + "\n\n".join(bundled_js_parts) + "\n})();\n"
    # Prevent accidental </script> termination inside JS
    full_js = full_js.replace("</script>", "<\\/script>")

    # Inline CSS and JS into HTML
    html = html.replace('<link rel="stylesheet" href="styles.css" />', f"<style>\n{css}\n</style>")
    html = html.replace('<script type="module" src="js/app.js"></script>', f"<script>\n{full_js}\n</script>")

    OUT_FILE.write_text(html, encoding="utf-8")
    size_kb = OUT_FILE.stat().st_size / 1024
    print(f"Built {OUT_FILE.name} ({size_kb:.1f} KB)")

if __name__ == "__main__":
    main()
