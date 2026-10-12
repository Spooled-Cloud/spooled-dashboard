/**
 * Queue scope of the API key behind the session (`queues` from `GET /auth/me`).
 *
 * The backend treats an empty list or a `*` entry as unrestricted. Organization-level
 * operations (deleting the organization, API-key administration, the incoming webhook log,
 * outgoing webhooks) are refused to every other key with 403.
 */

/** True when the key is limited to named queues; false for an unrestricted key or an unknown scope. */
export function isQueueScopedKey(queues: readonly string[] | null | undefined): boolean {
  return Array.isArray(queues) && queues.length > 0 && !queues.includes('*');
}

/** True only when the scope is known and unrestricted (an empty list or `*`). */
export function isUnrestrictedKey(queues: readonly string[] | null | undefined): boolean {
  return Array.isArray(queues) && !isQueueScopedKey(queues);
}
