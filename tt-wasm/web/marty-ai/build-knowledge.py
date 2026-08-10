#!/usr/bin/env python3
"""Build the Marty AI knowledge corpus.

Sources (same provenance as the art and demos -- the retail install and the original source):
  1. The shipped manual:  <retail>/doc/English/*.htm   (one FrontPage-era page per concept)
  2. The engine's own help strings:  dev/source/{english,new,puzzle,sensors}.rc
     (every canned hint Marty can say, in his own voice)
  3. port-notes.txt (hand-written, in this folder): what is different in the WASM port.

Output:
  knowledge-full.txt  -- for the cloud providers (Claude / OpenAI / Gemini), prompt-cached
  (knowledge-nano.txt is hand-written, not generated; we only report its size here)

Run:  python build-knowledge.py
"""
import re, sys, html
from pathlib import Path
from html.parser import HTMLParser

HERE = Path(__file__).resolve().parent                    # tt-wasm/web/marty-ai
DOC  = Path(r"C:\Program Files (x86)\Animated Programs\ToonTalk\doc\English")
SRC  = HERE.parents[2] / "source"                         # dev/source

# ---------------------------------------------------------------- page selection
# Curated: (section title, [pages in order]).  Everything not listed is skipped on
# purpose -- purchase/trial/installer/press/paper-abstract/error-dialog pages add
# bulk without helping Marty answer questions about USING ToonTalk.
SECTIONS = [
 ("WHAT TOONTALK IS", [
   "toontalk.htm", "about.htm", "kidsask.htm", "adultask.htm", "computer.htm",
   "kenkahn.htm", "origins.htm", "whomeet.htm", "you.htm"]),
 ("THE CITY, HOUSES, AND GETTING AROUND", [
   "location.htm", "flying.htm", "walking.htm", "inside.htm", "rocket.htm",
   "visitpg.htm", "playgrnd.htm"]),
 ("OBJECTS: NUMBERS, TEXT, BOXES", [
   "number.htm", "newnum.htm", "numbbase.htm", "slownumb.htm", "text.htm", "box.htm"]),
 ("OBJECTS: ROBOTS (PROGRAMS)", [
   "robot.htm", "bubble.htm"]),
 ("OBJECTS: BIRDS AND NESTS (MESSAGES)", [
   "bird.htm"]),
 ("OBJECTS: SCALES, TRUCKS, BOMBS, NOTEBOOKS", [
   "scale.htm", "truck.htm", "bomb.htm", "notebook.htm"]),
 ("PICTURES, SOUNDS, AND THE OUTSIDE WORLD", [
   "picture.htm", "sound.htm", "clpboard.htm", "sensor.htm", "remote.htm"]),
 ("TOOLS AND CHARACTERS", [
   "dusty.htm", "pumpy.htm", "tooly.htm", "bammer.htm", "wand.htm",
   "marty.htm", "marttalk.htm", "tts.htm"]),
 ("USING THE MOUSE AND KEYBOARD", [
   "mouse.htm", "dragdrop.htm", "keyboard.htm", "help.htm", "infodesk.htm"]),
 ("DEMOS, PUZZLES, AND FREE PLAY", [
   "demos.htm", "narrate.htm", "tt_dmo.htm", "games.htm", "programs.htm",
   "puzzle1.htm", "robotpuz.htm", "make_pzl.htm"]),
 ("TIME TRAVEL", [
   "ttravel.htm", "mk_ttdmo.htm", "slowtime.htm"]),
 ("PROGRAMMING CONCEPTS IN TOONTALK TERMS", [
   "equiv.htm", "concur.htm", "birdnest.htm"]),
 ("FREQUENTLY ASKED QUESTIONS", [
   "faq.htm"]),
]
# Any single page is capped so no page dominates the corpus.
PAGE_CHAR_CAP = {"faq.htm": 20000, "equiv.htm": 16000, "birdnest.htm": 12000,
                 "keyboard.htm": 14000}
DEFAULT_CAP = 7000

RC_FILES = ["english.rc", "new.rc", "puzzle.rc", "sensors.rc"]
RC_MIN_LEN = 60          # short fragments are sentence-assembly pieces, not hints
# Hints about Windows-era machinery that does not exist in the browser port.
RC_DROP = re.compile(
    r"(?i)(install|activation|purchase|trial|cd-?rom| diskette|directx|"
    r"joystick|force feedback|java|applet|printer|printing|screen saver|"
    r"virtual memory|16.bit|32.bit|windows (95|98|nt|xp|me)|web ?labs|"
    r"\bmci\b|registry|megabytes|sound card|video card)")

# ---------------------------------------------------------------- html -> text
# Only tags with CONTENT to suppress belong here. Void elements (input, img, br)
# must NOT be listed: they have no end tag, so a depth counter would stick on and
# swallow the whole rest of the page (the MS-Agent "Peedy" INPUT did exactly that).
SKIP_TAGS  = {"script", "style", "head", "object", "select"}
BLOCK_TAGS = {"p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "tr", "table",
              "ul", "ol", "blockquote", "hr"}

class TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out, self._skip = [], 0
    def handle_starttag(self, tag, attrs):
        if tag in SKIP_TAGS:
            self._skip += 1
        elif tag in BLOCK_TAGS:
            self.out.append("\n")
        elif tag == "li":
            self.out.append("\n- ")
        elif tag == "br":
            self.out.append("\n")
    def handle_endtag(self, tag):
        if tag in SKIP_TAGS:
            self._skip = max(0, self._skip - 1)
        elif tag in BLOCK_TAGS:
            self.out.append("\n")
    def handle_data(self, data):
        if not self._skip:
            self.out.append(data)

# footer / navigation / MS-Agent boilerplate: dropped only when the line is short,
# so body sentences that merely mention these words survive.
BOILER = re.compile(
    r"(?i)(peedy can read|back to|return to|home( page)?$|toontalk home|"
    r"table of contents|copyright|all rights reserved|animated programs$|"
    r"last (modified|updated)|www\.toontalk\.com|click here|press the .*button)")

def page_text(path: Path) -> str:
    raw = path.read_text(encoding="cp1252", errors="replace")
    p = TextExtractor(); p.feed(raw)
    text = "".join(p.out)
    # normalise cp1252 punctuation and whitespace
    text = (text.replace("\u2019", "'").replace("\u2018", "'")
                .replace("\u201c", '"').replace("\u201d", '"')
                .replace("\u2013", "-").replace("\u2014", "--")
                .replace("\u00a0", " "))
    lines = []
    for ln in text.split("\n"):
        ln = re.sub(r"[ \t]+", " ", ln).strip()
        if len(ln) < 70 and BOILER.search(ln):
            continue
        lines.append(ln)
    text = "\n".join(lines)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return text

# ---------------------------------------------------------------- rc -> hints
STR_RE = re.compile(r'"((?:[^"\\]|\\.)*)"')

def rc_hints(path: Path):
    seen, hints = set(), []
    for ln in path.read_text(encoding="cp1252", errors="replace").splitlines():
        if ln.lstrip().startswith("//"):
            continue
        ln = ln.split("//")[0]                       # trailing comments
        for m in STR_RE.finditer(ln):
            s = m.group(1).replace("\\r", " ").replace("\\n", " ").replace('\\"', '"')
            s = re.sub(r"\s+", " ", s).strip()
            if len(s) >= RC_MIN_LEN and s not in seen and not RC_DROP.search(s):
                seen.add(s); hints.append(s)
    return hints

# ---------------------------------------------------------------- build
def main():
    if not DOC.is_dir():
        sys.exit(f"retail doc folder not found: {DOC}")
    out, total_pages = [], 0
    out.append(
        "TOONTALK KNOWLEDGE BASE\n"
        "Compiled from the ToonTalk 3 shipped manual (doc/English) and the engine's own\n"
        "help strings. ToonTalk is Ken Kahn's animated programming world where programs\n"
        "are built by demonstration inside a city: robots are programs, boxes are data\n"
        "structures, birds carry messages to their nests, and tools like Dusty the\n"
        "vacuum, Pumpy the bike pump, and the magic wand edit the world.\n")
    for title, pages in SECTIONS:
        out.append(f"\n{'='*70}\nSECTION: {title}\n{'='*70}")
        for pg in pages:
            f = DOC / pg
            if not f.is_file():
                print(f"  MISSING {pg}", file=sys.stderr); continue
            txt = page_text(f)
            cap = PAGE_CHAR_CAP.get(pg, DEFAULT_CAP)
            if len(txt) > cap:
                cut = txt.rfind("\n", 0, cap)
                txt = txt[:cut if cut > cap * 0.6 else cap] + "\n[...trimmed...]"
            out.append(f"\n--- {pg} ---\n{txt}")
            total_pages += 1
    out.append(f"\n{'='*70}\nSECTION: MARTY'S OWN HELP LINES (from the engine)\n{'='*70}\n"
               "These are hints the game itself can give, in Marty's voice:")
    n_hints = 0
    for rc in RC_FILES:
        f = SRC / rc
        if not f.is_file():
            print(f"  MISSING {rc}", file=sys.stderr); continue
        for h in rc_hints(f):
            out.append(f"- {h}"); n_hints += 1
    notes = HERE / "port-notes.txt"
    if notes.is_file():
        out.append(f"\n{'='*70}\nSECTION: THIS BROWSER VERSION (THE WASM PORT)\n{'='*70}\n"
                   + notes.read_text(encoding="utf-8").strip())
    full = "\n".join(out) + "\n"
    (HERE / "knowledge-full.txt").write_text(full, encoding="utf-8")
    print(f"knowledge-full.txt: {len(full):,} chars (~{len(full)//4:,} tokens), "
          f"{total_pages} pages, {n_hints} engine hints")
    nano = HERE / "knowledge-nano.txt"
    if nano.is_file():
        n = len(nano.read_text(encoding="utf-8"))
        print(f"knowledge-nano.txt: {n:,} chars (~{n//4:,} tokens)  [hand-written]")

if __name__ == "__main__":
    main()
