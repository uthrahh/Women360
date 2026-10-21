/**
 * How much one tap on "+" adds toward a target: a round number about a tenth
 * of the way there, so 8 glasses go up by 1, 30 minutes by 5, 10,000 steps by
 * 1,000. It is only a shortcut; the exact amount can always be typed in.
 */
export function quickStep(target: number): number {
  if (!(target > 0)) return 1;
  if (target >= 5000) return 1000;
  if (target >= 500) return 100;
  if (target >= 50) return 10;
  if (target >= 25) return 5;
  return 1;
}
