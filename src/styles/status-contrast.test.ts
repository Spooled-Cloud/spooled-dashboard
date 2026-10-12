import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { blend, contrastRatio, oklchToSrgb } from '@/test/contrast';

const SRC = resolve(__dirname, '..');
const css = readFileSync(resolve(__dirname, 'global.css'), 'utf8');

/** Custom properties declared in the first `selector { ... }` block of global.css. */
function tokens(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`no ${selector} block in global.css`);
  const end = css.indexOf('\n  }', start);
  const out: Record<string, string> = {};
  for (const m of css.slice(start, end).matchAll(/(--[\w-]+):\s*(oklch\([^)]*\));/g)) {
    out[m[1]] = m[2];
  }
  return out;
}

const WCAG_AA_TEXT = 4.5;

describe.each([
  ['light theme (:root)', ':root'],
  ['dark theme (.dark)', '.dark'],
])('failed / dead-letter text contrast, %s', (_name, selector) => {
  const t = tokens(selector);
  const text = oklchToSrgb(t['--status-failed-text']);
  const page = oklchToSrgb(t['--background']);
  const card = oklchToSrgb(t['--card']);
  const failed = oklchToSrgb(t['--status-failed']);

  it('is readable on the page background', () => {
    expect(contrastRatio(text, page)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
  });

  it('is readable on a card', () => {
    expect(contrastRatio(text, card)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
  });

  it.each([0.05, 0.1, 0.2, 0.3])('is readable on a %s tint of --status-failed', (alpha) => {
    expect(contrastRatio(text, blend(failed, card, alpha))).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    expect(contrastRatio(text, blend(failed, page, alpha))).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
  });
});

describe('status-failed-foreground', () => {
  const light = tokens(':root');

  it('is near-white, so only valid as text on a solid --status-failed fill', () => {
    const foreground = oklchToSrgb(light['--status-failed-foreground']);
    const solid = oklchToSrgb(light['--status-failed']);
    expect(contrastRatio(foreground, solid)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);

    // The 2026-10-12 bug: the same token as text on the card or a pale tint is unreadable.
    const card = oklchToSrgb(light['--card']);
    expect(contrastRatio(foreground, card)).toBeLessThan(1.5);
    expect(contrastRatio(foreground, blend(solid, card, 0.2))).toBeLessThan(1.5);
  });

  it('is not used as a text colour anywhere in src (use text-status-failed-text)', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) {
          walk(path);
        } else if (/\.(tsx?|astro)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
          readFileSync(path, 'utf8')
            .split('\n')
            .forEach((line, i) => {
              // Allowed only next to a solid fill, e.g. "bg-status-failed text-status-failed-foreground".
              if (
                line.includes('text-status-failed-foreground') &&
                !/\bbg-status-failed(?![\w/-])/.test(line)
              ) {
                offenders.push(`${path.slice(SRC.length + 1)}:${i + 1}`);
              }
            });
        }
      }
    };
    walk(SRC);
    expect(offenders).toEqual([]);
  });
});
