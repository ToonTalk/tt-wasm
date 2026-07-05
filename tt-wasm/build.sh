#!/usr/bin/env bash
# Phase-0 syntax probe for the ToonTalk WASM port: can the C++ parse under
# clang/emcc with the Win32/DirectX compat shim? (-fsyntax-only = no codegen.)
#
#   ./build.sh             # compile probe.cpp
#   ./build.sh foo.cpp     # compile some other file (relative to this dir or abs)
#   ./build.sh foo.cpp 200 # show up to 200 lines of diagnostics
set -u
EMCC=/c/Users/toont/dev/emsdk/upstream/emscripten/emcc.exe
HERE="$(cd "$(dirname "$0")" && pwd)"
SRC=/c/Users/toont/dev/tt-wasm/src   # the forked, modernized copy (original source stays pristine)
TARGET="${1:-$HERE/probe.cpp}"
LINES="${2:-80}"

"$EMCC" -std=gnu++14 -fsyntax-only -w \
  -I"$HERE/shim" -I"$SRC" \
  "$TARGET" 2>&1 | head -"$LINES"
echo "=== exit ${PIPESTATUS[0]} ==="
