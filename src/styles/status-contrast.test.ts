import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { blend, contrastRatio } from '@/test/contrast';
import {
  THEMES,
  WCAG_AA_TEXT,
  solidOnlyForegrounds,
  surfaces,
  themeTokens,
  tokenColor,
} from '@/test/design-tokens';

const SRC = resolve(__dirname, '..');
const tailwindConfig = readFileSync(resolve(SRC, '..', 'tailwind.config.js'), 'utf8');

/** Status colours that have a dark text token (`--status-NAME-text`) next to their solid fill. */
const TEXT_TOKENS = Object.keys(themeTokens('light'))
  .map((key) => /^--(status-[\w-]+)-text$/.exec(key)?.[1])
  .filter((name): name is string => name !== undefined);

describe('status text tokens', () => {
  it('exist for failed and processing', () => {
    expect(TEXT_TOKENS).toEqual(expect.arrayContaining(['status-failed', 'status-processing']));
  });

  it.each(THEMES)('are defined in the %s theme too', (theme) => {
    for (const name of TEXT_TOKENS) {
      expect(themeTokens(theme)[`--${name}-text`], `--${name}-text`).toBeDefined();
    }
  });

  it('are reachable as text-status-NAME-text in tailwind.config.js', () => {
    for (const name of TEXT_TOKENS) {
      expect(tailwindConfig).toContain(`'var(--${name}-text)'`);
    }
  });
});

describe.each(THEMES)('status text contrast, %s theme', (theme) => {
  const { page, card } = surfaces(theme);

  describe.each(TEXT_TOKENS)('--%s-text', (name) => {
    const text = tokenColor(theme, `--${name}-text`);
    const fill = tokenColor(theme, `--${name}`);

    it('is readable on the page background', () => {
      expect(contrastRatio(text, page)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    });

    it('is readable on a card', () => {
      expect(contrastRatio(text, card)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    });

    it.each([0.05, 0.1, 0.2, 0.3])('is readable on a %s tint of the solid fill', (alpha) => {
      expect(contrastRatio(text, blend(fill, card, alpha))).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
      expect(contrastRatio(text, blend(fill, page, alpha))).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    });
  });
});

describe('solid-fill foreground tokens', () => {
  const solidOnly = solidOnlyForegrounds();

  it('are the near-white ones: primary, destructive, failed and processing', () => {
    // If this list changes, a token became unreadable (or readable) as plain text: review it.
    expect(solidOnly).toEqual(['destructive', 'primary', 'status-failed', 'status-processing']);
  });

  it('are readable on their own solid fill in the light theme', () => {
    for (const name of solidOnly.filter((n) => n !== 'primary')) {
      expect(
        contrastRatio(
          tokenColor('light', `--${name}-foreground`),
          tokenColor('light', `--${name}`)
        ),
        name
      ).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    }
  });

  it('are near-invisible as text on the card or a pale tint (the 2026-10-12 bug)', () => {
    const { card } = surfaces('light');
    for (const name of ['status-failed', 'status-processing']) {
      const foreground = tokenColor('light', `--${name}-foreground`);
      expect(contrastRatio(foreground, card), name).toBeLessThan(1.5);
      expect(
        contrastRatio(foreground, blend(tokenColor('light', `--${name}`), card, 0.2)),
        name
      ).toBeLessThan(1.5);
    }
  });

  it('each status one has a --status-NAME-text token to use for text instead', () => {
    for (const name of solidOnly.filter((n) => n.startsWith('status-'))) {
      expect(TEXT_TOKENS, `--${name}-text`).toContain(name);
    }
  });

  it('are not aliased to another tailwind colour', () => {
    for (const name of solidOnly) {
      const uses = tailwindConfig.split(`'var(--${name}-foreground)'`).length - 1;
      expect(uses, `--${name}-foreground in tailwind.config.js`).toBe(1);
    }
  });

  it('are used as a text colour only next to their solid bg-NAME fill', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) {
          if (path !== resolve(SRC, 'test')) walk(path);
        } else if (/\.(tsx?|astro|css)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
          readFileSync(path, 'utf8')
            .split('\n')
            .forEach((line, i) => {
              for (const name of solidOnly) {
                const asText = new RegExp(`(?<![\\w-])text-${name}-foreground(?![\\w-])`);
                const onFill = new RegExp(`(?<![\\w-])bg-${name}(?![\\w/-])`);
                if (asText.test(line) && !onFill.test(line)) {
                  offenders.push(`${path.slice(SRC.length + 1)}:${i + 1} text-${name}-foreground`);
                }
              }
            });
        }
      }
    };
    walk(SRC);
    expect(offenders).toEqual([]);
  });
});
