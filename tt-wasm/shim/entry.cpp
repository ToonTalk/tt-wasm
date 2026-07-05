/* WASM entry point. The native build entered at WinMain; under Emscripten we run
 * a normal main() that calls it. (WinMain runs win_main_initialize → the message
 * loop → finalize; with stubbed Win32 the loop's GetMessage returns 0 and it
 * unwinds, so this exercises the whole INIT path in wasm.) */
#include <cstdio>
#include "windows.h"

extern int WinMain(HINSTANCE, HINSTANCE, char *, int);

int main() {
  printf("[tt-wasm] main() reached — calling WinMain...\n");
  fflush(stdout);
  int r = WinMain((HINSTANCE)0, (HINSTANCE)0, (char *)"", 0);
  printf("[tt-wasm] WinMain returned %d\n", r);
  fflush(stdout);
  return 0;
}
