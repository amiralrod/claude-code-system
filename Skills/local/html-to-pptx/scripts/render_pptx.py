#!/usr/bin/env python3
"""render_pptx.py <deck.pptx> <outDir> — renders each pptx slide to PNG
via LibreOffice (pptx->pdf) + Poppler (pdf->png)."""
import glob
import os
import shutil
import subprocess
import sys
import tempfile

def soffice_path():
    p = shutil.which("soffice")
    if p:
        return p
    mac = "/Applications/LibreOffice.app/Contents/MacOS/soffice"
    return mac if os.path.exists(mac) else None

def main():
    if len(sys.argv) != 3:
        print("Usage: render_pptx.py <deck.pptx> <outDir>", file=sys.stderr)
        sys.exit(2)
    pptx, out_dir = os.path.abspath(sys.argv[1]), sys.argv[2]
    so = soffice_path()
    if not so:
        sys.exit("LibreOffice is not installed, so I can't render the PowerPoint "
                 "for visual checking. Install it with: brew install --cask libreoffice")
    if not shutil.which("pdftoppm"):
        sys.exit("Poppler (pdftoppm) is not installed. Install it with: brew install poppler")
    os.makedirs(out_dir, exist_ok=True)
    with tempfile.TemporaryDirectory() as td:
        subprocess.run([so, "--headless", "--convert-to", "pdf",
                        "--outdir", td, pptx], check=True, capture_output=True)
        pdfs = glob.glob(os.path.join(td, "*.pdf"))
        if not pdfs:
            sys.exit("LibreOffice produced no PDF — the .pptx may be corrupt.")
        subprocess.run(["pdftoppm", "-png", "-r", "96", pdfs[0],
                        os.path.join(out_dir, "slide")], check=True)
    n = len(glob.glob(os.path.join(out_dir, "slide-*.png")))
    print(f"Rendered {n} slide image(s) to {out_dir}")

if __name__ == "__main__":
    main()
