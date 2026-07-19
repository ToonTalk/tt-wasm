#!/usr/bin/env bash
# Compile every forked .cpp to a WASM object file (parallel) and report pass/fail.
# Excludes the dropped networking (DirectPlay/WinInet) and known #include-fragments
# (compiled into their parent TU, not standalone). Per-file errors -> logs/<name>.err.
EMCC=/c/Users/toont/dev/emsdk/upstream/emscripten/emcc.exe
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE" || exit 1
mkdir -p obj logs
# dropped / not-standalone:
EXCLUDE='(network|ftp|ttftp|number_old_display)'

ls src/*.cpp | grep -vE "/$EXCLUDE\.cpp$" \
  | xargs -P 6 -I{} bash -c '
      f="{}"; b=$(basename "$f" .cpp)
      if "'"$EMCC"'" -std=gnu++14 -fwasm-exceptions -w -DWIN32 -c "$f" -o "'"$HERE"'/obj/$b.o" \
           -I "'"$HERE"'/shim" -I "'"$HERE"'/src" 2>"'"$HERE"'/logs/$b.err"; then
        echo "OK   $b"
      else
        echo "FAIL $b"
      fi' \
  | sort | tee logs/_summary.txt
echo "=== PASS=$(grep -c "^OK" logs/_summary.txt)  FAIL=$(grep -c "^FAIL" logs/_summary.txt) ==="
