/* gmp_extra.c — the two GMP functions ToonTalk uses that mini-gmp doesn't provide.
 * See src/gmp.h for the story.
 */
#include "mini-gmp.h"

/* Remove all occurrences of the factor f from op; result in rop; returns how many
 * were removed. (The engine uses this to test denominators for 2^a*5^b — exact
 * decimal display.) */
mp_bitcnt_t mpz_remove (mpz_t rop, const mpz_t op, const mpz_t f)
{
  mp_bitcnt_t count = 0;
  mpz_t q, r;
  mpz_init (q);
  mpz_init (r);
  mpz_set (rop, op);
  if (mpz_cmpabs_ui (f, 1) > 0 && mpz_sgn (rop) != 0)
    {
      for (;;)
        {
          mpz_tdiv_qr (q, r, rop, f);
          if (mpz_sgn (r) != 0)
            break;
          mpz_swap (rop, q);
          count++;
        }
    }
  mpz_clear (q);
  mpz_clear (r);
  return count;
}

/* d in [0.5, 1) such that op ~= d * 2^exp2 — double conversion with explicit
 * exponent (display of huge numbers). Exact GMP semantics for ANY size: take
 * the top 53 bits via mpz division, so values beyond double range never
 * overflow to inf (Ken 2026-07-19: keep exact precision, don't round-trip
 * through a double). */
double frexp (double value, int *exp); /* avoid pulling all of math.h into C89-ish code */
double ldexp (double value, int exp);

double mpz_get_d_2exp (signed long int *exp2, const mpz_t op)
{
  size_t bits = mpz_sizeinbase (op, 2);
  if (mpz_sgn (op) == 0)
    {
      *exp2 = 0;
      return 0.0;
    }
  if (bits <= 53)
    {
      int e = 0;
      double d = frexp (mpz_get_d (op), &e);
      *exp2 = e;
      return d;
    }
  else
    {
      mpz_t top;
      double d;
      mpz_init (top);
      mpz_tdiv_q_2exp (top, op, bits - 53);   /* exact top 53 bits, fits a double */
      d = ldexp (mpz_get_d (top), -53);       /* scale into [0.5, 1) */
      mpz_clear (top);
      *exp2 = (signed long int) bits;
      return d;
    }
}
