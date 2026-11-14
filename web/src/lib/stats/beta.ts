/**
 * The regularized incomplete beta function and its inverse, written here so
 * the project takes no extra dependency for one distribution.
 *
 * Used for the Jeffreys range in docs/number-logic.md section 5: the 5% and
 * 95% points of a Beta(fireYears + 0.5, years - fireYears + 0.5).
 *
 * Accuracy target: 1e-6 on the inverse.
 */

const LANCZOS = [
  676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012,
  9.9843695780195716e-6, 1.5056327351493116e-7,
];

/** Natural log of the gamma function, for x > 0 (Lanczos approximation, g = 7, n = 9). */
export function logGamma(x: number): number {
  if (x < 0.5) {
    // Reflection, so the series is only used on the right half plane.
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  }
  const z = x - 1;
  let series = 0.99999999999980993;
  for (let i = 0; i < LANCZOS.length; i++) series += LANCZOS[i] / (z + i + 1);
  const t = z + LANCZOS.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(series);
}

/** Natural log of the beta function B(a, b). */
export function logBeta(a: number, b: number): number {
  return logGamma(a) + logGamma(b) - logGamma(a + b);
}

const TINY = 1e-300;

/** Continued fraction for the incomplete beta function (modified Lentz method). */
function betaContinuedFraction(a: number, b: number, x: number): number {
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < TINY) d = TINY;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 3e-16) break;
  }
  return h;
}

/** Regularized incomplete beta function I_x(a, b), the Beta(a, b) distribution function. */
export function incompleteBeta(a: number, b: number, x: number): number {
  if (!(a > 0) || !(b > 0)) throw new Error("incompleteBeta needs a > 0 and b > 0");
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(a * Math.log(x) + b * Math.log(1 - x) - logBeta(a, b));
  if (x < (a + 1) / (a + b + 2)) {
    return (front * betaContinuedFraction(a, b, x)) / a;
  }
  return 1 - (front * betaContinuedFraction(b, a, 1 - x)) / b;
}

/**
 * The p quantile of a Beta(a, b) distribution: the x where I_x(a, b) = p.
 *
 * Bisection on [0, 1]. The distribution function is strictly increasing there,
 * so 80 halvings leave an interval far below the 1e-6 target.
 */
export function betaQuantile(a: number, b: number, p: number): number {
  if (!(a > 0) || !(b > 0)) throw new Error("betaQuantile needs a > 0 and b > 0");
  if (!(p >= 0 && p <= 1)) throw new Error("betaQuantile needs p in [0, 1]");
  if (p === 0) return 0;
  if (p === 1) return 1;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (incompleteBeta(a, b, mid) < p) lo = mid;
    else hi = mid;
    if (hi - lo < 1e-15) break;
  }
  return (lo + hi) / 2;
}
