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

# Appended to resort_infinity.htm. Every hint below is the city's own -- the flip-over text
# pads inside resort_infinity.xml.cty, transcribed -- with <details> standing in for flipping
# the pad over, so answers stay hidden until asked for (Ken, 2026-08-12: "there needs to be
# much more instructions for how to build houses for guests and moving them").
RESORT_STEPS = """
<h2>Working the resort, step by step</h2>
<p><i>These instructions and hints are the city's own flip-over pads, gathered here.
Click a hint to "flip it over".</i></p>
<p>Point at a problem's sign and press the <b>space bar</b> to turn it on; from then on a
new guest arrives on that problem's nest every 5 seconds, forever. Solutions are given to
the <b>Solution bird</b> as a two-hole box labelled <b>Move</b> and <b>Build</b>. The Build
hole holds a box of your address robot and the guests' nest; the Move hole holds a move
robot and nest (empty until problem 2). Never two cottages at the same address. Press
<b>F8</b> to pause the robots and look around; F8 again resumes. Save your city after each
solved problem.</p>
<h3>Problem 1 &mdash; the first infinite group</h3>
<p>&ldquo;Since there are no cottages to move at first just leave the first hole
empty.&rdquo; &ldquo;Put the Problem 1 nest in the Guests hole.&rdquo; Your Address Robot
accepts a box with the guest's number and a bird, and must give the bird the address where
that guest's cottage is built. Train it exactly the way the activity sheets trained
<tt>Doubler</tt> and <tt>Add 1</tt>.</p>
<details><summary>Flip over: what address should the first guest get?</summary>
<p>Address 1 &mdash; &ldquo;a robot that gives each guest the next address&rdquo;: guest
<i>i</i> lives at cottage <i>i</i>. Give the guest's own number to the bird.</p></details>
<details><summary>Flip over: I give up. What do I give the Solution bird?</summary>
<p>The ready-made solution box &mdash; the page's <b>Answer to problem 1</b> button puts it
in your hand. <b>Its Guests hole is empty on purpose:</b> before giving the box to the
Solution bird, pick up the <b>Problem 1 nest</b> (the one the guests are arriving on) and
drop it into the empty Guests hole. Without the nest, nothing reaches the robots and no
cottages get built.</p></details>
<h3>Problem 2 &mdash; five more guests, no empty cottages</h3>
<p>&ldquo;This time you'll also need a Move Robot. It needs a box like this:&rdquo; a
current address and a bird. It computes where that guest should move and gives the new
address to the bird; the guest blows up their cottage and moves. &ldquo;Fill the empty
Guests hole with the Problem 2 nest.&rdquo;</p>
<details><summary>Flip over: where should the guest in cottage 1 move to?</summary>
<p>&ldquo;Add 5 to the current address and give the result to the bird.&rdquo; Everyone
moves up five; the five newcomers get cottages 1 to 5. (Is the Build robot any different
from problem 1's?)</p></details>
<h3>Problem 3 &mdash; a second infinite group</h3>
<details><summary>Flip over: adding will not work this time&hellip;</summary>
<p>&ldquo;Multiply the current address by 2 and give the result to the bird.&rdquo; The old
guests take the even addresses; &ldquo;this robot puts the new guests in the odd numbered
cottages&rdquo; &mdash; new guest <i>i</i> builds at 2<i>i</i>&minus;1.</p></details>
<h3>Problem 4 &mdash; three infinite groups at once</h3>
<details><summary>Flip over for the move robot</summary>
<p>&ldquo;Multiply the current address by 4 and give the result to the bird.&rdquo;</p>
</details>
<details><summary>Flip over for the build robot</summary>
<p>&ldquo;This robot assigns new guests to addresses that are not multiples of 4&rdquo;
&mdash; guest <i>i</i> of group <i>j</i> builds at 4<i>i</i>&minus;<i>j</i>. (Merging the
three guest streams into one, with Activity 2's Merge robot, also works.)</p></details>
<h3>Problem 5 &mdash; infinitely many infinite groups</h3>
<details><summary>Flip over: remember the even addresses are already taken</summary>
<p>&ldquo;This one moves the guests like problem 3&rdquo; &mdash; double the address. Then
the city's own build robot &ldquo;assigns new guests to odd addresses by successive squares
in the upper left corner of the square of all new guests&rdquo;; its hint walks the diagonal:
&ldquo;the next addresses are 2,2 then 1,2 then 3,1 then 3,2 then 3,3 then 2,3 then
1,3&rdquo;. (The teachers' guide offers the classic alternative: send group <i>j</i>'s guest
<i>i</i> to the <i>j</i>th prime raised to the <i>i</i>th power &mdash; wasteful of
addresses, and that waste is worth discussing.)</p></details>
<p>&ldquo;Robots on my back deal with sending out announcements to the guests and arranging
for new cottages to be built&rdquo; &mdash; the text pad in the lower right corner of the
room runs the machinery; you never need to touch it.</p>
"""

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

    # 0. The authors' review comments. The PDF export drops them, but the HTML export keeps
    #    the in-text anchors -- a red "[KK1]" in the middle of a heading (Ken's screenshot,
    #    2026-08-12) -- and, in documents that carry them, the comment texts at the end.
    h = re.sub(r"<span class=MsoCommentReference>.*?</span>", "", h, flags=re.S)
    h = re.sub(r"<a[^>]*(?:msocomanchor|_msoanchor_|_msocom_)[^>]*>.*?</a>", "", h, flags=re.S)
    h = re.sub(r"<div[^>]*style='[^']*mso-element:comment-list[^']*'[^>]*>.*", "", h, flags=re.S)
    h = re.sub(r"<hr class=msocomoff[^>]*>.*", "", h, flags=re.S)

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
    # A paragraph that says just "Explain" -- plain, bold, trailing dot or ellipsis, the
    # punctuation sometimes in a span of its own -- was an instruction to fill the ruled
    # space below it. ("Explain in general what..." is a real sentence and stays.)
    BARE_EXPLAIN = (r"<p[^>]*>\s*(?:<b>)?(?:<span[^>]*>)?\s*Explain\s*[.…]?\s*"
                    r"(?:</span>)?\s*(?:</b>)?\s*(?:<span[^>]*>\s*[.…]\s*</span>)?\s*</p>")

    def box(m):
        inner = m.group(1)
        blanks = len(re.findall(EMPTY_P, inner))
        inner = re.sub(EMPTY_P, "", inner)
        # An answer box is one with room to write -- blank ruled lines, or a bare "Explain"
        # pointing at the space. On screen it is a prompt to think about instead, so the
        # paper mechanics come out (Ken, 2026-08-12).
        kind = "think" if (blanks >= 2 or re.search(BARE_EXPLAIN, inner)) else "callout"
        if kind == "think":
            inner = re.sub(BARE_EXPLAIN, "", inner)
            inner = re.sub(r"(?:<span[^>]*>)?\s*Write your answer here[^<.]*[.…]?\s*(?:</span>)?",
                           "", inner)
        return '<div class="%s">%s</div>' % (kind, inner)
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
        if f == "resort_infinity.htm":
            body += RESORT_STEPS
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
