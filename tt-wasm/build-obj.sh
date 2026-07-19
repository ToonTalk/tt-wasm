#!/usr/bin/env bash
# Compile a single forked .cpp to its LINKED object (obj/<name>.o) — same flags as build-all.sh.
# link.sh links obj/*.o, so this is the incremental-rebuild helper.
#   ./build-obj.sh src/winmain.cpp
#   ./build-obj.sh prgrmmr.cpp        # bare names resolve against src/
set -u
EMCC=/c/Users/toont/dev/emsdk/upstream/emscripten/emcc.exe
HERE="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$HERE/obj" "$HERE/logs"
ARG="$1"
case "$ARG" in
  /*) TARGET="$ARG" ;;
  *)  if [ -f "$HERE/$ARG" ]; then TARGET="$HERE/$ARG"; else TARGET="$HERE/src/$ARG"; fi ;;
esac
B=$(basename "$TARGET" .cpp)
if "$EMCC" -std=gnu++14 -fwasm-exceptions -w -DWIN32 -c "$TARGET" -o "$HERE/obj/$B.o" \
     -I "$HERE/shim" -I "$HERE/src" 2>"$HERE/logs/$B.err"; then
  echo "=== OK: obj/$B.o ($(stat -c %s "$HERE/obj/$B.o") bytes) ==="
else
  echo "=== FAIL: $B ==="; tail -40 "$HERE/logs/$B.err"; exit 1
fi
