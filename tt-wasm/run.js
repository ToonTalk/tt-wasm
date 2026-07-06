// Node test harness: emscripten's fps=0 main loop uses requestAnimationFrame,
// which node lacks — polyfill it with setTimeout so frames pump headlessly.
// (In the real browser target, the native rAF drives it.)
let t0 = Date.now();
let frames = 0;
globalThis.requestAnimationFrame = (cb) => setTimeout(() => {
  frames++;
  if (frames % 60 === 0) console.log(`[harness] ${frames} frames pumped (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  // Headless auto-descend: after boot, hold the left button at screen centre so the helicopter
  // flies down and lands (reaches the zoomed-in lawn scene that the browser can only get to via
  // real input). Lets us profile the landed-scene leak headlessly. Enable with TT_AUTODESCEND=1.
  if (process.env.TT_AUTODESCEND && frames === 150) {
    globalThis.TT_mouse_x = 400; globalThis.TT_mouse_y = 300;
    globalThis.TT_msgq = globalThis.TT_msgq || [];
    globalThis.TT_msgq.push({ message: 0x0201, wParam: 0, lParam: 0 }); // WM_LBUTTONDOWN, held
    console.log('[harness] injected held LBUTTONDOWN — descending');
  }
  cb(Date.now() - t0);
}, 16);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
// emscripten resolves tt.data relative to cwd, so run from build/
const path = require('path');
process.chdir(path.join(__dirname, 'build'));
require(path.join(__dirname, 'build', 'tt.js'));
