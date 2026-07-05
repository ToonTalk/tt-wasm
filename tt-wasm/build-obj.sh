#!/usr/bin/env bash
# Phase-0 object compile for the ToonTalk WASM port. Compiles a single .cpp to a
# WASM object file (.o). Unresolved externals at *link* time are EXPECTED in
# phase 0 — we only care that the translation unit type-checks and emits an
# object. (No -fsyntax-only here: we want a real .o.)
#
#   ./build-obj.sh number.cpp        # compiles /c/Users/toont/dev/source/number.cpp -> build/number.o
#   ./build-obj.sh /abs/path.cpp 200 # show up to 200 diagnostic lines
set -u
EMCC=/c/Users/toont/dev/emsdk/upstream/emscripten/emcc.exe
HERE="$(cd "$(dirname "$0")" && pwd)"
SRC=/c/Users/toont/dev/source
LINES="${2:-80}"
mkdir -p "$HERE/build"

# Allow either a bare name (resolved against the source tree) or an absolute path.
ARG="$1"
case "$ARG" in
  /*) TARGET="$ARG" ;;
  *)  if [ -f "$HERE/$ARG" ]; then TARGET="$HERE/$ARG"; else TARGET="$SRC/$ARG"; fi ;;
esac
BASE="$(basename "${TARGET%.cpp}")"
OUT="$HERE/build/$BASE.o"

"$EMCC" -std=gnu++14 -w -c \
  -I"$HERE/shim" -I"$SRC" \
  "$TARGET" -o "$OUT" 2>&1 | head -"$LINES"
RC="${PIPESTATUS[0]}"
if [ "$RC" = "0" ] && [ -f "$OUT" ]; then
  echo "=== OK: $OUT ($(stat -c%s "$OUT") bytes) ==="
else
  echo "=== exit $RC (no object emitted) ==="
fi
