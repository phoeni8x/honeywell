/**
 * Server-safe plain text sanitizer.
 * Removes HTML tags and control chars, then bounds length.
 */
export function sanitizePlainText(input: string, maxLength = 5000): string {
  const bounded = String(input ?? "").slice(0, maxLength);
  const withoutTags = bounded.replace(/<[^>]*>/g, " ");
  const withoutControls = withoutTags.replace(/[\u0000-\u001F\u007F]/g, " ");
  return withoutControls.replace(/\s+/g, " ").trim();
}
