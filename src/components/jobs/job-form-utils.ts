/**
 * Small parsing helpers shared by the job creation forms.
 */

/** Backend range for max_retries (CreateJobRequest / BulkEnqueueRequest). */
export const MAX_RETRIES_MIN = 0;
export const MAX_RETRIES_MAX = 100;
export const MAX_RETRIES_DEFAULT = 3;

/**
 * Parse a number input, keeping an explicit 0. Only an unparseable value (empty, NaN)
 * falls back; `parseInt(v) || fallback` turned an intentional 0 into the fallback.
 */
export function parseIntInRange(value: string, fallback: number, min: number, max: number): number {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function parseMaxRetries(value: string): number {
  return parseIntInRange(value, MAX_RETRIES_DEFAULT, MAX_RETRIES_MIN, MAX_RETRIES_MAX);
}

/**
 * Convert a `datetime-local` value (wall-clock time in the browser's zone, no seconds or
 * offset) into an RFC 3339 instant the backend's `DateTime<Utc>` accepts.
 * Returns undefined for empty input and null for an unparseable value.
 */
export function localDateTimeToIso(value: string): string | undefined | null {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
