/**
 * Queue and job forms are labeled in milliseconds. The API stores whole seconds
 * (1–86400). A value that is not a positive whole number of seconds is rejected
 * here, instead of being floored (1500 ms used to be stored as 1 second).
 */

export const TIMEOUT_MIN_SECONDS = 1;
export const TIMEOUT_MAX_SECONDS = 86400;

export const TIMEOUT_WHOLE_SECONDS_MESSAGE =
  'Timeout must be a whole number of seconds (a multiple of 1000 ms), between 1 and 86400 seconds.';

export class InvalidTimeoutError extends Error {
  constructor(message = TIMEOUT_WHOLE_SECONDS_MESSAGE) {
    super(message);
    this.name = 'InvalidTimeoutError';
  }
}

/** Milliseconds from a form → seconds for the API. Throws when the value would be shortened. */
export function timeoutMsToSeconds(ms: number): number {
  if (!Number.isInteger(ms) || ms % 1000 !== 0) {
    throw new InvalidTimeoutError();
  }
  const seconds = ms / 1000;
  if (seconds < TIMEOUT_MIN_SECONDS || seconds > TIMEOUT_MAX_SECONDS) {
    throw new InvalidTimeoutError();
  }
  return seconds;
}
