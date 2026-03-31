/** Matches DB format: 3 uppercase letters (no I/O) + 3 digits (2–9). For client-side display / demo seeds only. */
export function generatePaymentReferenceCodeClient(): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  let s = "";
  for (let i = 0; i < 3; i++) s += letters[Math.floor(Math.random() * letters.length)]!;
  for (let i = 0; i < 3; i++) s += digits[Math.floor(Math.random() * digits.length)]!;
  return s;
}
