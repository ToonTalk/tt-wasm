#!/usr/bin/env bash
# Stage the built-in art from the (read-only) M25 source tree into assets/, which the WASM
# build preloads into the Emscripten FS. Reproducible: re-run any time from dev/M25.
#
#   1. copy the sprite BMPs + .TTS descriptors into assets/pics (lowercased names — the engine
#      builds lowercase paths from filestts.h and the Emscripten FS is case-sensitive).
#   2. fill referenced-but-missing animation frames by substitution (M25 is a partial set).
#   3. synthesize the m25/m800/resind .us1 container (real palette lifted from a BMP; sprite
#      descriptors come from the loose .tts files at load time, pixels from the BMPs).
set -eu
HERE="$(cd "$(dirname "$0")/.." && pwd)"
M25="C:/Users/toont/dev/M25"
PICS="$HERE/assets/pics"
mkdir -p "$PICS"

echo "[1/3] staging BMPs + TTS from $M25 (lowercased)"
for f in "$M25"/*.BMP "$M25"/*.TTS; do
  [ -e "$f" ] || continue
  b="$(basename "$f")"; lc="$(echo "$b" | tr 'A-Z' 'a-z')"
  cp -f "$f" "$PICS/$lc"
done
echo "      staged $(ls "$PICS"/*.bmp 2>/dev/null | wc -l) bmp, $(ls "$PICS"/*.tts 2>/dev/null | wc -l) tts"

echo "[2/3] filling missing animation frames by substitution"
python "$HERE/tools/fill_missing_frames.py"

echo "[3/3] synthesizing .us1 container (with real palette)"
python "$HERE/tools/make_dat.py"

echo "done. rebuild with: bash link.sh"
