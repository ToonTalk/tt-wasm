/* WASM entry point. The native build entered at WinMain; under Emscripten we run
 * a normal main() that calls it. (WinMain runs win_main_initialize → the message
 * loop → finalize; with stubbed Win32 the loop's GetMessage returns 0 and it
 * unwinds, so this exercises the whole INIT path in wasm.) */
#include <cstdio>
#include <cstring>
#include "windows.h"
#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#endif

extern int WinMain(HINSTANCE, HINSTANCE, char *, int);

/* The engine's command line. ToonTalk's own switches work here exactly as they did
 * on Windows — notably "-I <demo>" to replay a .dmo demo reproducing its original
 * timing (utils.cpp interpret_command_line; log.cpp add_demo_extension resolves a
 * bare name to <MainDir>Demos\<name>.dmo). pre.js fills TT_cmdline from the page
 * URL (?demo=explode2) before the runtime starts. */
static char tt_command_line[1024] = "";

int main() {
#ifdef __EMSCRIPTEN__
  EM_ASM({
    var s = (typeof TT_cmdline === 'string') ? TT_cmdline : '';
    if (s) stringToUTF8(s, $0, 1023);
  }, tt_command_line);
  if (tt_command_line[0]) {
    printf("[tt] cmdline: '%s'\n", tt_command_line);
    fflush(stdout);
  }
#endif
  printf("[tt-wasm] main() reached — calling WinMain...\n");
  fflush(stdout);
  int r = WinMain((HINSTANCE)0, (HINSTANCE)0, tt_command_line, 0);
  printf("[tt-wasm] WinMain returned %d\n", r);
  fflush(stdout);
  return 0;
}
