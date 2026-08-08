#!/usr/bin/env python3
"""embed_fonts.py <deck.pptx> <slides.json> — embeds the deck's TTF fonts
inside the .pptx (PowerPoint's standard embedded-fonts feature). Finds font
files locally first, then downloads from Google Fonts into fonts-cache/."""
import glob
import json
import os
import re
import shutil
import sys
import tempfile
import urllib.request
import zipfile

from lxml import etree

from rebuild import WEIGHT_SUFFIX, font_name

P_NS = "http://schemas.openxmlformats.org/presentationml/2006/main"
R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
CT_NS = "http://schemas.openxmlformats.org/package/2006/content-types"
REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
FONT_REL = ("http://schemas.openxmlformats.org/officeDocument/2006/"
            "relationships/font")

LOCAL_DIRS = [os.path.expanduser("~/Library/Fonts"), "/Library/Fonts",
              "/System/Library/Fonts", "/System/Library/Fonts/Supplemental"]
CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "fonts-cache")

WEIGHT_FILE = {100: "Thin", 200: "ExtraLight", 300: "Light", 400: "Regular",
               500: "Medium", 600: "SemiBold", 700: "Bold", 800: "ExtraBold",
               900: "Black"}

def needed_typefaces(fonts):
    """Group captured (family, weight, italic) into PowerPoint typefaces.
    weight 700 -> the base family's 'bold' slot; other weights get suffixed
    typeface names whose 'regular' slot holds that weight's file."""
    groups = {}
    for f in fonts:
        name = font_name(f["family"], f["weight"])
        slot = "bold" if f["weight"] == 700 else "regular"
        if f["italic"]:
            slot = "boldItalic" if slot == "bold" else "italic"
        groups.setdefault(name, {"typeface": name, "family": f["family"], "slots": {}})
        groups[name]["slots"][slot] = (f["weight"], f["italic"])
    return list(groups.values())

def find_local(family, weight, italic):
    base = family.replace(" ", "")
    wname = WEIGHT_FILE.get(weight, "Regular")
    cands = [f"{base}-{wname}Italic.ttf" if italic else f"{base}-{wname}.ttf"]
    if weight == 400 and italic:
        cands.append(f"{base}-Italic.ttf")
    for d in LOCAL_DIRS + [CACHE]:
        for c in cands:
            hits = glob.glob(os.path.join(d, "**", c), recursive=True)
            if hits:
                return hits[0]
    return None

def download_google(family, weight, italic):
    os.makedirs(CACHE, exist_ok=True)
    dest = os.path.join(CACHE, f"{family.replace(' ', '')}-{weight}"
                               f"{'i' if italic else ''}.ttf")
    if os.path.exists(dest):
        return dest
    fam = family.replace(" ", "+")
    url = (f"https://fonts.googleapis.com/css2?family={fam}:ital,wght@"
           f"{1 if italic else 0},{weight}")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/4.0"})
    css = urllib.request.urlopen(req, timeout=20).read().decode()
    m = re.search(r"url\((https://[^)]+\.ttf)\)", css)
    if not m:
        raise RuntimeError("Google Fonts did not return a TTF")
    with urllib.request.urlopen(m.group(1), timeout=30) as r, open(dest, "wb") as f:
        shutil.copyfileobj(r, f)
    return dest

def resolve(fonts):
    """-> (entries for embed(), plain-English notes)."""
    entries, notes = [], []
    for g in needed_typefaces(fonts):
        entry = {"typeface": g["typeface"], "regular": None, "bold": None,
                 "italic": None, "boldItalic": None}
        family = g["family"]
        for slot, (weight, italic) in g["slots"].items():
            path = find_local(family, weight, italic)
            if not path:
                try:
                    path = download_google(family, weight, italic)
                except Exception as exc:
                    notes.append(
                        f"Could not get a font file for {g['typeface']} "
                        f"(weight {weight}): {exc}. The deck still names this "
                        "font; colleagues without it installed will see a "
                        "substitute. Install it from "
                        f"https://fonts.google.com/specimen/{family.replace(' ', '+')}")
                    continue
            entry[slot] = path
        if any(entry[s] for s in ("regular", "bold", "italic", "boldItalic")):
            entries.append(entry)
    return entries, notes

SKIP_EMBED = {"Helvetica", "Arial", "Times New Roman", "Courier New", "Georgia",
              "Verdana", "Tahoma", "Segoe UI", "Calibri", "-apple-system",
              "system-ui", "Apple Color Emoji"}

def embed(pptx_path, entries):
    if not entries:
        return
    tmp_fd, tmp_path = tempfile.mkstemp(suffix=".pptx")
    os.close(tmp_fd)
    with zipfile.ZipFile(pptx_path) as zin:
        names = zin.namelist()
        ct = etree.fromstring(zin.read("[Content_Types].xml"))
        rels = etree.fromstring(zin.read("ppt/_rels/presentation.xml.rels"))
        pres = etree.fromstring(zin.read("ppt/presentation.xml"))

        if not any(d.get("Extension") == "fntdata"
                   for d in ct.findall(f"{{{CT_NS}}}Default")):
            d = etree.SubElement(ct, f"{{{CT_NS}}}Default")
            d.set("Extension", "fntdata")
            d.set("ContentType", "application/x-fontdata")

        rid_nums = [int(r.get("Id")[3:]) for r in rels
                    if r.get("Id", "").startswith("rId")]
        next_rid = max(rid_nums, default=0) + 1

        pres.set("embedTrueTypeFonts", "1")
        lst = pres.find(f"{{{P_NS}}}embeddedFontLst")
        if lst is None:
            lst = etree.Element(f"{{{P_NS}}}embeddedFontLst")
            anchor = pres.find(f"{{{P_NS}}}notesSz")
            anchor.addnext(lst)

        font_parts = []
        font_no = 0
        for e in entries:
            ef = etree.SubElement(lst, f"{{{P_NS}}}embeddedFont")
            fnt = etree.SubElement(ef, f"{{{P_NS}}}font")
            fnt.set("typeface", e["typeface"])
            for slot, tag in (("regular", "regular"), ("bold", "bold"),
                              ("italic", "italic"), ("boldItalic", "boldItalic")):
                if not e[slot]:
                    continue
                font_no += 1
                part = f"ppt/fonts/font{font_no}.fntdata"
                rid = f"rId{next_rid}"
                next_rid += 1
                font_parts.append((part, e[slot]))
                rel = etree.SubElement(rels, f"{{{REL_NS}}}Relationship")
                rel.set("Id", rid)
                rel.set("Type", FONT_REL)
                rel.set("Target", part.replace("ppt/", ""))
                s = etree.SubElement(ef, f"{{{P_NS}}}{tag}")
                s.set(f"{{{R_NS}}}id", rid)

        with zipfile.ZipFile(tmp_path, "w", zipfile.ZIP_DEFLATED) as zout:
            for n in names:
                if n == "[Content_Types].xml":
                    zout.writestr(n, etree.tostring(ct, xml_declaration=True,
                                                    encoding="UTF-8", standalone=True))
                elif n == "ppt/_rels/presentation.xml.rels":
                    zout.writestr(n, etree.tostring(rels, xml_declaration=True,
                                                    encoding="UTF-8", standalone=True))
                elif n == "ppt/presentation.xml":
                    zout.writestr(n, etree.tostring(pres, xml_declaration=True,
                                                    encoding="UTF-8", standalone=True))
                else:
                    zout.writestr(n, zin.read(n))
            for part, path in font_parts:
                zout.write(path, part)
    shutil.move(tmp_path, pptx_path)

def main():
    if len(sys.argv) != 3:
        print("Usage: embed_fonts.py <deck.pptx> <slides.json>", file=sys.stderr)
        sys.exit(2)
    with open(sys.argv[2]) as f:
        fonts = [f_ for f_ in json.load(f).get("fonts", [])
                 if f_["family"] not in SKIP_EMBED]
    entries, notes = resolve(fonts)
    embed(sys.argv[1], entries)
    for e in entries:
        got = [s for s in ("regular", "bold", "italic", "boldItalic") if e[s]]
        print(f"Embedded {e['typeface']} ({', '.join(got)})")
    for n in notes:
        print("NOTE: " + n)

if __name__ == "__main__":
    main()
