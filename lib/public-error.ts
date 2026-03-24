/**
 * Single user-facing error copy for API responses and client fallbacks.
 * Never expose stack traces, DB errors, migration names, or provider details.
 */
export const PUBLIC_ERROR_TRY_AGAIN_OR_GUEST = "Error try again please.";

/** Use for any client UI error that might otherwise echo API `error` strings — never pass through raw server text. */
export function safeClientError(): string {
  return PUBLIC_ERROR_TRY_AGAIN_OR_GUEST;
}
