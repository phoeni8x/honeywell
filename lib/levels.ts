export function calculateLevel(totalOrders: number, totalSpentHuf: number): number {
  if (totalOrders >= 25 && totalSpentHuf >= 500_000) return 4;
  if (totalOrders >= 10 && totalSpentHuf >= 100_000) return 3;
  if (totalOrders >= 3 && totalSpentHuf >= 20_000) return 2;
  return 1;
}

export const LEVEL_META: Record<
  number,
  { name: string; bonusPointsPct: number; color: string }
> = {
  1: { name: "Newbie", bonusPointsPct: 0, color: "#4CAF50" },
  2: { name: "Regular", bonusPointsPct: 5, color: "#2D6A2D" },
  3: { name: "VIP", bonusPointsPct: 10, color: "#C8972A" },
  4: { name: "Top Tier", bonusPointsPct: 15, color: "#FFD700" },
};

export function basePointsFromOrderHuf(totalHuf: number): number {
  // New earning rule: 800 points per full 10,000 HUF.
  return Math.floor(totalHuf / 10_000) * 800;
}

export function pointsWithLevelBonus(basePoints: number, level: number): number {
  // Points earning is flat by spend bucket; level does not boost points.
  void level;
  return basePoints;
}
