#!/usr/bin/env python
"""Build web/infinity/sheets from the ToonTalk website's Infinity material.

The activity worksheets only exist as Word 97 .doc files. Word itself does the two
conversions -- run this FIRST (Windows, Word installed; SaveAs2 takes plain arguments
because [ref] marshalling fails on PowerShell 5.1):

    $src  = "<Infinity>\\Doc"
    $work = "<scratch>"
    $word = New-Object -ComObject Word.Application; $word.Visible = $false; $word.DisplayAlerts = 0
    foreach ($d in (Get-ChildItem $src -Filter *.doc | ? { $_.Name -notlike '~$*' })) {
      $doc = $word.Documents.Open($d.FullName, $false, $true)
      $doc.SaveAs2("$work\\html\\" + $d.BaseName + ".htm", 10)   # 10 = filtered HTML
      $doc.SaveAs2("$work\\pdf\\"  + $d.BaseName + ".pdf", 17)   # 17 = PDF
      $doc.Close(0)
    }
    $word.Quit()

then:  python build-sheets.py <scratch> <Infinity folder>

The PDF is what the reader sees by default: Word's HTML export turns the worksheets'
floating pictures into position:absolute spans carrying page-based pixel offsets, so in
a reflowing pane the two Martys drift a page below the speech balloons they belong under
(Ken, 2026-08-11). The PDF keeps the layout the worksheets were written in. The HTML is
still built as a reflowing text alternate, with those absolutes put back into the flow.
"""

import os, re, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
DST = os.path.join(HERE, "sheets")
TTDST = os.path.join(HERE, "tt")

# The ToonTalk-website pages that surrounded the worksheets. Their own stylesheet and the
# navigation bar lived at ../../ paths that no longer exist, so keep only the editable body.
SITE_PAGES = ["guidance.htm", "guidance2.htm", "historical_note.htm",
              "resort_infinity_guide.htm", "diagonal.htm", "no_copies.htm",
              "notebook.htm", "resort_infinity.htm"]

HEAD = ('<!doctype html><html><head><meta charset="windows-1252">'
        '<title>%s</title><link rel="stylesheet" href="sheet.css"></head><body>')


def clean_word_html(h):
    """Undo the two things Word's filtered HTML does that a reflowing pane cannot honour."""
    # 1. Floating pictures: position:absolute + margin-left/top measured from Word's page.
    #    Put them back in the flow at their anchor, which is where they were anchored anyway.
    h = re.sub(r"position:absolute;?", "", h)
    h = re.sub(r"z-index:-?\d+;?", "", h)
    h = re.sub(r"margin-left:\d+px;\s*margin-top:\d+px;?", "", h)
    # 2. The empty 16pt paragraphs Word inserts to reserve the space those floats occupied.
    #    Without the floats they are just a screenful of nothing. Collapse runs of them.
    empty_p = (r"(?:<p class=MsoNormal><span style='[^']*'>&nbsp;</span></p>\s*){3,}")
    h = re.sub(empty_p, "<p class=MsoNormal>&nbsp;</p>\n", h)
    return h


def clean_site_page(path):
    h = open(path, encoding="windows-1252", errors="replace").read()
    m = re.search(r'InstanceBeginEditable name="mainbody" -->(.*?)<!-- InstanceEndEditable',
                  h, re.S)
    body = m.group(1) if m else re.sub(r"(?is)^.*?<body[^>]*>|</body>.*$", "", h)
    t = re.search(r"<title>(.*?)</title>", h, re.S | re.I)
    title = t.group(1).strip() if t else os.path.basename(path)
    # Pictures lived one level up, beside the .tt files; here they sit next to the page.
    body = re.sub(r'(src|background)="\.\./([^"/]+)"', r'\1="\2"', body)
    # Cross-section links (Lunar Lander, LEGO Mindstorms...) point at pages we do not have.
    body = re.sub(r'href="\.\./\.\./[^"]*"', 'href="#"', body)
    # A link to a .tt becomes a request to load it into the ToonTalk pane. Anchors that wrap
    # a picture keep the picture (class 'imgload'); text ones are styled as buttons.
    def as_load(mm):
        return 'href="#" data-load="%s"' % mm.group(1)
    body = re.sub(r'href="\.\./([A-Za-z0-9_.]+)\.(?:tt|cty)"', as_load, body)
    body = re.sub(r'(<a [^>]*data-load="[^"]+")([^>]*>)(\s*<img)',
                  r'\1 class="imgload"\2\3', body)
    return title, body


def main():
    work = sys.argv[1] if len(sys.argv) > 1 else None
    infinity = sys.argv[2] if len(sys.argv) > 2 else None
    if not work or not infinity:
        sys.exit(__doc__)

    os.makedirs(DST, exist_ok=True)
    os.makedirs(TTDST, exist_ok=True)
    n = 0
    shutil.copy2(os.path.join(HERE, "sheet.css"), os.path.join(DST, "sheet.css"))

    # --- worksheets: PDF (faithful) + HTML (reflowing text alternate) ------------------
    pdfdir = os.path.join(DST, "pdf")
    os.makedirs(pdfdir, exist_ok=True)
    for e in sorted(os.listdir(os.path.join(work, "pdf"))):
        shutil.copy2(os.path.join(work, "pdf", e), os.path.join(pdfdir, e)); n += 1

    html = os.path.join(work, "html")
    for e in sorted(os.listdir(html)):
        s, d = os.path.join(html, e), os.path.join(DST, e)
        if os.path.isdir(s):                       # Word's own image directory
            if os.path.exists(d): shutil.rmtree(d)
            shutil.copytree(s, d)
        else:
            open(d, "w", encoding="windows-1252", errors="replace").write(
                clean_word_html(open(s, encoding="windows-1252", errors="replace").read()))
        n += 1

    # --- the surrounding website pages -------------------------------------------------
    for f in SITE_PAGES:
        p = os.path.join(infinity, "Doc", f)
        if not os.path.exists(p): continue
        title, body = clean_site_page(p)
        open(os.path.join(DST, f), "w", encoding="windows-1252", errors="replace").write(
            (HEAD % title) + body + "</body></html>")
        n += 1

    # --- pictures those pages reference, and the ToonTalk material itself ---------------
    for e in sorted(os.listdir(infinity)):
        s = os.path.join(infinity, e)
        if not os.path.isfile(s): continue
        if e.lower().endswith((".png", ".gif", ".jpg", ".bmp")):
            shutil.copy2(s, os.path.join(DST, e)); n += 1
        elif e.lower().endswith((".tt", ".cty")):
            # Served for download as well as preloaded into tt.data, so the programs can be
            # taken away and opened in a desktop ToonTalk.
            shutil.copy2(s, os.path.join(TTDST, e)); n += 1
    hn = os.path.join(infinity, "Doc", "historical_note_files")
    if os.path.isdir(hn):
        d = os.path.join(DST, "historical_note_files")
        if os.path.exists(d): shutil.rmtree(d)
        shutil.copytree(hn, d)

    print("built %d entries into %s" % (n, DST))


if __name__ == "__main__":
    main()
