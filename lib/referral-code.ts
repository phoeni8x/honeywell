const ALPHANUM = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateReferralCode(): string {
  let s = "";
  for (let i = 0; i < 6; i++) {
    s += ALPHANUM[Math.floor(Math.random() * ALPHANUM.length)];
  }
  return `HW-${s}`;
}
