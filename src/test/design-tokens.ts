/**
 * Reads the colour tokens in src/styles/global.css so tests can check them against WCAG contrast
 * and resolve Tailwind `text-*` classes to the colour a browser would paint.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { contrastRatio, oklchToSrgb, type Rgb } from './contrast';

export type Theme = 'light' | 'dark';

export const THEMES: Theme[] = ['light', 'dark'];
export const WCAG_AA_TEXT = 4.5;

const SELECTOR: Record<Theme, string> = { light: ':root', dark: '.dark' };
const css = readFileSync(resolve(__dirname, '../styles/global.css'), 'utf8');

/** Custom properties declared in the first `selector { ... }` block of global.css. */
export function themeTokens(theme: Theme): Record<string, string> {
  const selector = SELECTOR[theme];
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`no ${selector} block in global.css`);
  const end = css.indexOf('\n  }', start);
  const out: Record<string, string> = {};
  for (const m of css.slice(start, end).matchAll(/(--[\w-]+):\s*(oklch\([^)]*\));/g)) {
    out[m[1]] = m[2];
  }
  return out;
}

/** The two surfaces text normally sits on: the page and a card. */
export function surfaces(theme: Theme): { page: Rgb; card: Rgb } {
  const t = themeTokens(theme);
  return { page: oklchToSrgb(t['--background']), card: oklchToSrgb(t['--card']) };
}

/** Colour of a design token (`--status-failed`) in a theme. */
export function tokenColor(theme: Theme, token: string): Rgb {
  const value = themeTokens(theme)[token];
  if (!value) throw new Error(`${token} is not defined in the ${theme} theme`);
  return oklchToSrgb(value);
}

/**
 * Names (without `--`, as Tailwind spells them: `primary`, `status-processing`) of every
 * `--NAME-foreground` token that cannot be read on the page or on a card in at least one theme.
 * Those are meant for text on a solid `bg-NAME` fill and nowhere else.
 */
export function solidOnlyForegrounds(): string[] {
  const names = new Set<string>();
  for (const theme of THEMES) {
    const tokens = themeTokens(theme);
    const { page, card } = surfaces(theme);
    for (const key of Object.keys(tokens)) {
      const name = /^--(.+)-foreground$/.exec(key)?.[1];
      if (!name || !(`--${name}` in tokens)) continue;
      const foreground = oklchToSrgb(tokens[key]);
      if (
        contrastRatio(foreground, page) < WCAG_AA_TEXT ||
        contrastRatio(foreground, card) < WCAG_AA_TEXT
      ) {
        names.add(name);
      }
    }
  }
  return [...names].sort();
}

/** The colour a bare `text-NAME` class paints in a theme, or null when NAME is not a design token. */
export function textClassColor(className: string, theme: Theme): Rgb | null {
  const name = /^text-([a-z][\w-]*)$/.exec(className)?.[1];
  const value = name ? themeTokens(theme)[`--${name}`] : undefined;
  return value ? oklchToSrgb(value) : null;
}
