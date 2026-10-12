/**
 * Merge helper for the admin "Custom Limits" editor.
 *
 * The backend replaces the whole `custom_limits` column on save, so the editor must start from
 * the organization's existing overrides and touch only the keys the operator actually edited.
 * Keys the form does not show (or that are an explicit `null`, i.e. unlimited) survive a save.
 */

export type CustomLimits = Record<string, number | null>;

/** Form value meaning "no cap" for a resource limit. Saved as -1 (the backend also accepts null). */
export const UNLIMITED = 'unlimited';

/** Resource caps that can be unlimited; settings (payload size, rate limit, retention) cannot. */
export const UNLIMITED_CAPABLE_KEYS: readonly string[] = [
  'max_jobs_per_day',
  'max_active_jobs',
  'max_queues',
  'max_workers',
  'max_api_keys',
  'max_schedules',
  'max_workflows',
  'max_webhooks',
];

/** Form string for a stored override: unlimited caps (null or -1) read as 'unlimited'. */
export function limitToFormValue(key: string, value: unknown): string {
  if (UNLIMITED_CAPABLE_KEYS.includes(key) && (value === null || value === -1)) return UNLIMITED;
  return typeof value === 'number' ? String(value) : '';
}

/**
 * @param existing the org's current custom_limits (may be null)
 * @param initial  what the form fields held when the dialog opened (key -> string)
 * @param edited   what the form fields hold now (key -> string)
 * @returns the object to save, or null when no overrides remain (plan defaults)
 */
export function mergeCustomLimits(
  existing: Record<string, unknown> | null | undefined,
  initial: Record<string, string>,
  edited: Record<string, string>
): CustomLimits | null {
  const result: Record<string, unknown> = { ...(existing ?? {}) };

  for (const [key, raw] of Object.entries(edited)) {
    if (raw === (initial[key] ?? '')) continue; // untouched: keep whatever is stored

    const value = raw.trim();
    if (value === '') {
      // The operator cleared a field that had a value: drop the key (plan default).
      delete result[key];
      continue;
    }
    if (value === UNLIMITED) {
      if (UNLIMITED_CAPABLE_KEYS.includes(key)) result[key] = -1;
      continue;
    }
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 0) {
      result[key] = num;
    }
  }

  return Object.keys(result).length === 0 ? null : (result as CustomLimits);
}
