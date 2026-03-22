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
  return Math.floor(totalHuf / 1000) * 10;
}

export function pointsWithLevelBonus(basePoints: number, level: number): number {
  const pct = LEVEL_META[level]?.bonusPointsPct ?? 0;
  return Math.floor(basePoints * (1 + pct / 100));
}
