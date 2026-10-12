/**
 * The operations home must stay readable in both themes: every piece of text painted with a
 * design-token colour (`text-status-processing-text`, `text-muted-foreground`, ...) reaches
 * WCAG AA against the page and a card. The near-white `*-foreground` tokens are for text on a
 * solid fill and measure about 1:1 on the card, which hid the processing count of the queue
 * rows and the failed / dead-letter counts in 0.1.75.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { mockDashboard } from '@/test/mocks/handlers';
import { render, screen, mockAuthenticatedState } from '@/test/utils';
import { contrastRatio } from '@/test/contrast';
import {
  THEMES,
  WCAG_AA_TEXT,
  solidOnlyForegrounds,
  surfaces,
  textClassColor,
  tokenColor,
  type Theme,
} from '@/test/design-tokens';
import { DashboardHomeEnhanced, QueuesPanel } from './DashboardHomeEnhanced';

const API_BASE = 'https://api.spooled.cloud';

const busyDashboard = {
  ...mockDashboard,
  jobs: { ...mockDashboard.jobs, deadletter: 12, failed_24h: 30, pending: 50, processing: 10 },
  recent_activity: { ...mockDashboard.recent_activity, jobs_failed_1h: 5 },
  queues: [
    { name: 'billing', pending: 9, processing: 7, paused: false },
    { name: 'emails', pending: 20, processing: 13, paused: true },
  ],
};

interface ColouredText {
  text: string;
  className: string;
  /** The element that carries `className`: the text's own, else the nearest ancestor. */
  carrier: Element;
}

/**
 * Every element under `root` that has text of its own, with the design-token colour class that
 * paints it (CSS inheritance: its own class, else the nearest ancestor's). Text with no token
 * colour (plain `text-sm`, an arbitrary palette colour) is left out.
 */
function colouredText(root: Element, theme: Theme): ColouredText[] {
  const found: ColouredText[] = [];
  for (const el of Array.from(root.querySelectorAll('*'))) {
    const text = Array.from(el.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent?.trim() ?? '')
      .join('');
    if (text === '') continue;
    for (let carrier: Element | null = el; carrier; carrier = carrier.parentElement) {
      const className = Array.from(carrier.classList).find(
        (c) => textClassColor(c, theme) !== null
      );
      if (className) {
        found.push({ text, className, carrier });
        break;
      }
    }
  }
  return found;
}

/**
 * Text with a token colour that is below WCAG AA, as "text is class". Normal text is measured
 * against the page and a card. A near-white `text-NAME-foreground` is measured against its own
 * solid `bg-NAME` fill when the same element has one (a destructive button), and fails
 * without it.
 */
function unreadableText(root: Element, theme: Theme): string[] {
  const { page, card } = surfaces(theme);
  const solidOnly = solidOnlyForegrounds();
  return colouredText(root, theme)
    .filter(({ className, carrier }) => {
      const colour = textClassColor(className, theme)!;
      const solid = solidOnly.find((name) => className === `text-${name}-foreground`);
      if (solid && carrier.classList.contains(`bg-${solid}`)) {
        return contrastRatio(colour, tokenColor(theme, `--${solid}`)) < WCAG_AA_TEXT;
      }
      return (
        contrastRatio(colour, page) < WCAG_AA_TEXT || contrastRatio(colour, card) < WCAG_AA_TEXT
      );
    })
    .map(({ text, className }) => `"${text}" is ${className}`);
}

beforeEach(async () => {
  await mockAuthenticatedState();
  server.use(http.get(`${API_BASE}/api/v1/dashboard`, () => HttpResponse.json(busyDashboard)));
  // recharts constructs a ResizeObserver; the shared test setup mock is not constructible.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('queue rows on the operations home', () => {
  it('paint the processing count with the dark text token, not the fill foreground', async () => {
    render(<QueuesPanel />);

    for (const count of ['7', '13']) {
      const span = await screen.findByText(count);
      expect(span).toHaveClass('text-status-processing-text');
      expect(span).not.toHaveClass('text-status-processing-foreground');
    }
  });

  it.each(THEMES)('keep every counted and captioned value readable, %s theme', async (theme) => {
    const { container } = render(<QueuesPanel />);
    await screen.findByText('billing');

    // The rows are really inspected: the pending and processing counts are among them.
    const inspected = colouredText(container, theme).map(({ text }) => text);
    expect(inspected).toEqual(expect.arrayContaining(['9', '7', '20', '13', 'Paused']));
    expect(unreadableText(container, theme)).toEqual([]);
  });
});

describe('the whole operations home', () => {
  it.each(THEMES)('has no unreadable status text, %s theme', async (theme) => {
    const { container } = render(<DashboardHomeEnhanced />);
    await screen.findByText('billing');

    // The failed / dead-letter counts (12 and 30) are there and are inspected too.
    const inspected = colouredText(container, theme).map(({ text }) => text);
    expect(inspected).toEqual(expect.arrayContaining(['12', '30', '7', '13']));
    expect(unreadableText(container, theme)).toEqual([]);
  });
});
