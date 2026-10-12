/**
 * Where to send the user after they sign in again.
 *
 * The path (including query and hash) is kept in sessionStorage under
 * `redirect_after_login` when a protected page bounces to the login page.
 */

const KEY = 'redirect_after_login';

/** Remember the current page (path + query + hash) unless it is the login page itself. */
export function rememberReturnPath(): void {
  if (typeof window === 'undefined') return;
  const { pathname, search, hash } = window.location;
  if (pathname === '/') return;
  try {
    sessionStorage.setItem(KEY, `${pathname}${search}${hash}`);
  } catch {
    // storage unavailable
  }
}

/**
 * Read and clear the remembered path. Only same-origin destinations are returned.
 * The value is resolved against our own origin and kept only if it stays
 * same-origin; this rejects absolute URLs ("https://evil.com"), protocol-relative
 * ("//evil.com") and backslash-normalized ("/\evil.com") open redirects that a simple
 * leading-slash check would let through.
 */
export function consumeReturnPath(): string | null {
  if (typeof window === 'undefined') return null;
  let stored: string | null = null;
  try {
    stored = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
  } catch {
    return null;
  }
  if (!stored) return null;
  try {
    const url = new URL(stored, window.location.origin);
    if (url.origin === window.location.origin) {
      return url.pathname + url.search + url.hash;
    }
  } catch {
    // fall through
  }
  return null;
}
