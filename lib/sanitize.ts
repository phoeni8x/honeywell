import DOMPurify from "isomorphic-dompurify";

/** Strip HTML; safe for usernames, notes, titles. */
export function sanitizePlainText(input: string, maxLength = 5000): string {
  const trimmed = input.slice(0, maxLength);
  return DOMPurify.sanitize(trimmed, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}
