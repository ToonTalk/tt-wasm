// Node test harness: emscripten's fps=0 main loop uses requestAnimationFrame,
// which node lacks — polyfill it with setTimeout so frames pump headlessly.
// (In the real browser target, the native rAF drives it.)
let t0 = Date.now();
let frames = 0;
globalThis.requestAnimationFrame = (cb) => setTimeout(() => {
  frames++;
  if (frames % 60 === 0) console.log(`[harness] ${frames} frames pumped (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  // Headless auto-descend: after boot, hold the 'd' key (DOWN_IF_IN_HELICOPTER accelerator) so
  // the helicopter flies down, lands, and hands over to walking. In ABSOLUTE mouse mode the
  // left button is reserved for selection, so descent is keyboard-driven — matching real play.
  // Enable with TT_AUTODESCEND=1.
  if (process.env.TT_AUTODESCEND && frames >= 150 && frames < 1400 && (frames % 2) === 0) {
    globalThis.TT_mouse_x = 400; globalThis.TT_mouse_y = 300;
    globalThis.TT_msgq = globalThis.TT_msgq || [];
    if (globalThis.TT_msgq.length < 4) globalThis.TT_msgq.push({ message: 0x0102, wParam: 100, lParam: 0 }); // WM_CHAR 'd', autorepeat
    if (frames === 150) console.log('[harness] holding "d" — descending');
  }
  cb(Date.now() - t0);
}, 16);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
// emscripten resolves tt.data relative to cwd, so run from build/
const path = require('path');
process.chdir(path.join(__dirname, 'build'));
require(path.join(__dirname, 'build', 'tt.js'));
