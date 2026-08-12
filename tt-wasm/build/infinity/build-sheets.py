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


EMPTY_P = r"<p class=MsoNormal[^>]*>(?:<span style='[^']*'>)?&nbsp;(?:</span>)?</p>"
FLOATSPAN = r"<span\s+style='[^']*margin-left:-?\d+px[^']*'>.*?</span>"


def clean_word_html(h):
    """Turn Word's print layout into something a reflowing reading pane can honour."""
    # 1. Floating pictures carry position:absolute plus offsets measured from Word's page.
    #    The VERTICAL offset is the harmful one -- it is counted from wherever the anchoring
    #    paragraph happens to land, so it throws the picture a page away once text reflows.
    h = re.sub(r"position:absolute;?", "", h)
    h = re.sub(r"z-index:-?\d+;?", "", h)
    h = re.sub(r"margin-top:-?\d+px;?", "", h)

    # 1b. Activity 5 floats a speech balloon over the NEIGHBOURING table cell -- the one with
    #     Marty in it. Word's export left the balloon in the text cell, where no amount of
    #     styling puts it back over Marty. Move the balloon's picture into Marty's paragraph
    #     (in front of him), where rule 1d lays the pair out as balloon-above-Marty. Word
    #     helpfully labels balloon pictures alt="Speech Bubble: ...".
    def across_cells(mm):
        tr = mm.group(0)
        b = re.search(r"<span\s+style='[^']*margin-left:[^']*'>\s*"
                      r"(<img[^>]*alt=\"Speech Bubble[^>]*>)\s*</span>", tr, re.S)
        if not b:
            return tr
        rest = tr[:b.start()] + tr[b.end():]
        marty = re.search(r"<p class=MsoNormal[^>]*>()(?=(?:(?!</p>).)*margin-left)", rest, re.S)
        if not marty:
            return tr
        at = marty.end(1)
        return rest[:at] + b.group(1) + rest[at:]
    h = re.sub(r"<tr>.*?</tr>", across_cells, h, flags=re.S)

    # 1c. A paragraph holding SEVERAL floated pictures is a row of them -- the two Martys
    #     under the two balloons in activities 2 and 4. Their margin-left said which side of
    #     the page each belonged on; spread them across the width in that order instead.
    def float_row(m):
        inner = m.group(1)
        parts = re.findall(FLOATSPAN, inner, re.S)
        if len(parts) < 2:
            return m.group(0)
        keys = [int(re.search(r"margin-left:(-?\d+)px", p).group(1)) for p in parts]
        order = sorted(range(len(parts)), key=lambda i: keys[i])
        body = "".join(re.sub(r"margin-left:-?\d+px;?", "", parts[i]) for i in order)
        return '<p class="floatrow">%s</p>' % body
    h = re.sub(r"<p class=MsoNormal[^>]*>(.*?)</p>", float_row, h, flags=re.S)

    # 1d. ONE floated picture beside an inline picture is Marty and his balloon sharing a
    #     table cell (activities 1 and 5): on the page the balloon sits above him, tail down.
    #     Make the pair a centred column in that order (Ken, 2026-08-12: they came out as a
    #     wrapping row with Marty on top).
    def speaker(m):
        inner = m.group(1)
        floats = re.findall(FLOATSPAN, inner, re.S)
        if len(floats) != 1:
            return m.group(0)
        inline_imgs = re.findall(r"<img[^>]*>", re.sub(FLOATSPAN, "", inner, flags=re.S))
        if not inline_imgs:
            return m.group(0)
        marty = re.sub(r"margin-left:-?\d+px;?", "", floats[0])
        return '<p class="speaker">%s%s</p>' % ("".join(inline_imgs), marty)
    h = re.sub(r"<p class=MsoNormal[^>]*>(.*?)</p>", speaker, h, flags=re.S)

    # 1e. Any float still standing is on its own -- the balloon over a heading in activity 7,
    #     or a lone Marty in an otherwise empty cell. Let it float right of its anchor, which
    #     is where the page had it.
    h = re.sub(r"<span\s+style='([^']*)margin-left:-?\d+px;?([^']*)'(?=>\s*<img)",
               "<span class=\"fltr\" style='\\1\\2'", h)
    # 2. The empty 16pt paragraphs Word inserts to reserve the space those floats occupied.
    #    Without the floats they are just a screenful of nothing. Collapse runs of them.
    h = re.sub(r"(?:%s\s*){3,}" % EMPTY_P, "<p class=MsoNormal>&nbsp;</p>\n", h)

    # 3. The bordered boxes. On paper these are two different things that look alike: a
    #    CHALLENGE/CLAIM to read, and a question followed by ruled space to write an answer in.
    #    On screen the writing space is just a hole (Ken, 2026-08-12), so the empty paragraphs
    #    come out and the box is marked up as something to think about instead.
    def box(m):
        inner = m.group(1)
        blanks = len(re.findall(EMPTY_P, inner))
        inner = re.sub(EMPTY_P, "", inner)
        return '<div class="%s">%s</div>' % ("think" if blanks >= 2 else "callout", inner)
    # Non-greedy to the first </div>: these boxes hold paragraphs, never another box.
    h = re.sub(r"<div style='border:solid[^']*'>(.*?)</div>", box, h, flags=re.S)

    # 4. A row of pictures Word laid out for an 8.5in page is wider than this pane, and the
    #    pictures sit against each other with no whitespace, so there is nothing for the line
    #    to break at -- the row spills off both edges. Marked so it can wrap.
    def img_row(m):
        return ('<p class="imgrow">%s</p>' % m.group(1)) if m.group(1).count("<img") >= 2 \
               else m.group(0)
    h = re.sub(r"<p class=MsoNormal[^>]*>(.*?)</p>", img_row, h, flags=re.S)

    # 5. Word's export carries its own <style>; ours has to come after it to win.
    h = h.replace("</head>", '<link rel="stylesheet" href="sheet.css"></head>', 1)
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
    # A link to a .tt becomes a request to load it into the ToonTalk pane. The FULL file name
    # rides along -- resort_infinity.xml.cty is a city, and guessing extensions engine-side
    # made its button a no-op. Anchors that wrap a picture keep the picture (class 'imgload');
    # text ones are styled as buttons.
    def as_load(mm):
        return 'href="#" data-load="%s"' % mm.group(1)
    body = re.sub(r'href="\.\./([A-Za-z0-9_.]+\.(?:tt|cty))"', as_load, body)
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
