/** Rachas que se celebran a lo grande. */
const MILESTONES = [7, 14, 21, 30, 50, 75, 100, 150, 200, 250, 300, 365];

export function isMilestone(streak: number): boolean {
  return MILESTONES.includes(streak) || (streak > 365 && streak % 100 === 0);
}
