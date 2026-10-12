import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyText } from './clipboard';

function setClipboard(value: unknown) {
  Object.defineProperty(navigator, 'clipboard', { value, configurable: true });
}

describe('copyText', () => {
  const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');

  afterEach(() => {
    if (original) {
      Object.defineProperty(navigator, 'clipboard', original);
    } else {
      // jsdom has no clipboard by default
      delete (navigator as unknown as { clipboard?: unknown }).clipboard;
    }
  });

  it('resolves true after writing the text', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    await expect(copyText('sk_live_abc')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('sk_live_abc');
  });

  it('resolves false when the browser rejects the write', async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new DOMException('denied')) });
    await expect(copyText('x')).resolves.toBe(false);
  });

  it('resolves false when the clipboard API is missing (insecure context)', async () => {
    setClipboard(undefined);
    await expect(copyText('x')).resolves.toBe(false);
  });
});
