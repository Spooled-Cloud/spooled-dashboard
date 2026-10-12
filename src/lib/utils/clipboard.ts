/**
 * Copy text to the clipboard without ever throwing.
 *
 * `navigator.clipboard` is missing on insecure origins and `writeText` rejects when the
 * permission is denied or the document is not focused, so every caller has to handle a
 * failed copy. Resolves true when the text was copied, false otherwise.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
