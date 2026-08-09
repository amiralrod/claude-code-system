#!/usr/bin/env python3
"""render_pptx.py <deck.pptx> <outDir> — renders each pptx slide to PNG
via LibreOffice (pptx->pdf) + Poppler (pdf->png)."""
import glob
import os
import platform
import shutil
import subprocess
import sys
import tempfile


def _install_hint(*, brew_cask=None, brew=None, apt=None):
    sys_name = platform.system()
    if sys_name == "Darwin":
        if brew_cask:
            return f"brew install --cask {brew_cask}"
        return f"brew install {brew}"
    elif sys_name == "Linux":
        return f"sudo apt-get install {apt}   # Debian/Ubuntu"
    return f"install {brew_cask or brew or apt} for your platform"


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
        sys.exit(
            "LibreOffice is not installed — the visual verify step is not available.\n"
            f"Install it with:  {_install_hint(brew_cask='libreoffice', apt='libreoffice')}"
        )
    if not shutil.which("pdftoppm"):
        sys.exit(
            "Poppler (pdftoppm) is not installed — needed for the verify step.\n"
            f"Install it with:  {_install_hint(brew='poppler', apt='poppler-utils')}"
        )
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
