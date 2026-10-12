/**
 * localStorage keys for the dashboard trend history.
 *
 * The history is queue depth / failure / worker counts of one organization, so it is
 * keyed by organization and API key and removed when the session ends.
 */

const KEY_PREFIX = 'spooled_dashboard_timeseries';

/** Unscoped key written by versions before 0.1.74 (shared by every org and user). */
const LEGACY_KEY = KEY_PREFIX;

export function timeseriesStorageKey(organizationId: string, userId: string): string {
  return `${KEY_PREFIX}:${organizationId}:${userId}`;
}

/** Remove the trend history of the signed-in scope and every other leftover history. */
export function clearStoredTimeseries(scopedKey?: string | null): void {
  try {
    const keys = new Set<string>([LEGACY_KEY]);
    if (scopedKey) keys.add(scopedKey);
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(KEY_PREFIX)) keys.add(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch {
    // storage unavailable
  }
}
