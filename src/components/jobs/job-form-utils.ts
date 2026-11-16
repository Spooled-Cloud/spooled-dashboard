/**
 * Small parsing helpers shared by the job creation forms.
 */

/** Backend range for max_retries (CreateJobRequest / BulkEnqueueRequest). */
export const MAX_RETRIES_MIN = 0;
export const MAX_RETRIES_MAX = 100;

/**
 * Parse a number input, keeping an explicit 0. Only an unparseable value (empty, NaN)
 * falls back; `parseInt(v) || fallback` turned an intentional 0 into the fallback.
 */
export function parseIntInRange(value: string, fallback: number, min: number, max: number): number {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * Max retries typed into a job form, or undefined when the field is blank (or not a number).
 * Undefined must be left out of the request: the backend then uses the queue's configured
 * `max_retries`, and only uses a sent value. Sending a made-up 3 overrode the queue setting.
 */
export function parseMaxRetries(value: string): number | undefined {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return undefined;
  return Math.min(MAX_RETRIES_MAX, Math.max(MAX_RETRIES_MIN, n));
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
