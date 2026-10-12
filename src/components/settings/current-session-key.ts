/**
 * The API key behind this dashboard session, for the guards that keep a user from switching
 * off or revoking the key they are signed in with.
 */

import { useAuthStore } from '@/stores/auth';

/**
 * Shown when `/auth/me` cannot say which key the session uses. The guard then refuses: an
 * unknown key must never count as "not the session key", because the destructive call would
 * sign the user out mid-action.
 */
export const SESSION_KEY_UNKNOWN_MESSAGE =
  'Could not confirm which API key your dashboard session uses, so no key can be switched off or revoked right now. Reload the page and try again.';

/**
 * The id of the API key behind this session. Read from the auth store when `/auth/me` has
 * loaded; otherwise `/auth/me` is fetched again first (the store swallows a failed fetch, so
 * it is the result that tells). `undefined` means the id is still unknown after the retry.
 */
export async function resolveCurrentKeyId(): Promise<string | undefined> {
  const known = useAuthStore.getState().user?.api_key_id;
  if (known) return known;
  try {
    await useAuthStore.getState().fetchCurrentUser();
  } catch {
    // fetchCurrentUser reports its own failures; an id that is still missing is the answer.
  }
  return useAuthStore.getState().user?.api_key_id || undefined;
}
