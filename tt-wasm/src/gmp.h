/* gmp.h — WASM port replacement (2026-07-19).
 *
 * The original file (kept as gmp.h.win32.orig) declared the Win32 GMP 3.x DLL
 * interface; the .lib binaries are x86 COFF and can't link into wasm, so every
 * mpz_/mpq_ call had silently become a return-0 JS stub — all rational
 * arithmetic (fractional sensor values, big numbers, exact comparisons)
 * degenerated (e.g. Pong's ball-position sensor read 0 forever, so the Serve
 * robot never re-served).
 *
 * Now backed by mini-gmp + mini-mpq (the official minimal GMP subset, shipped
 * with GMP, LGPLv3+/GPLv2+), compiled to wasm like everything else. Two
 * functions the engine uses that mini-gmp lacks (mpz_remove, mpz_get_d_2exp)
 * are implemented in shim/gmp_extra.c.
 */
#ifndef TT_WASM_GMP_H
#define TT_WASM_GMP_H

#include "../shim/mini-gmp.h"
#include "../shim/mini-mpq.h"

#if defined (__cplusplus)
extern "C" {
#endif

/* implemented in shim/gmp_extra.c */
mp_bitcnt_t mpz_remove (mpz_t rop, const mpz_t op, const mpz_t f);
double mpz_get_d_2exp (signed long int *exp2, const mpz_t op);

#if defined (__cplusplus)
}
#endif

#endif /* TT_WASM_GMP_H */
