// Node test harness: emscripten's fps=0 main loop uses requestAnimationFrame,
// which node lacks — polyfill it with setTimeout so frames pump headlessly.
// (In the real browser target, the native rAF drives it.)
let t0 = Date.now();
let frames = 0;
globalThis.requestAnimationFrame = (cb) => setTimeout(() => {
  frames++;
  if (frames % 60 === 0) console.log(`[harness] ${frames} frames pumped (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  cb(Date.now() - t0);
}, 16);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
// emscripten resolves tt.data relative to cwd, so run from build/
const path = require('path');
process.chdir(path.join(__dirname, 'build'));
require(path.join(__dirname, 'build', 'tt.js'));
