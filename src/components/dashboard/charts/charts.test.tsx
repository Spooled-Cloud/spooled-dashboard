import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@/test/utils';
import { StatusDistributionChart } from './StatusDistributionChart';
import { BacklogTrendChart, FailureTrendChart, WorkerTrendChart } from './TrendCharts';

const SIZE_WARNING = /should be greater than 0/;

function sizeWarnings(warn: ReturnType<typeof vi.spyOn>): unknown[][] {
  return warn.mock.calls.filter((call: unknown[]) => SIZE_WARNING.test(String(call[0])));
}

describe('dashboard charts', () => {
  beforeEach(() => {
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
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  /** jsdom has no layout; report the 320 x 300 box a browser would measure for the container. */
  function mockMeasuredContainer() {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 320,
      height: 300,
      top: 0,
      left: 0,
      right: 320,
      bottom: 300,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
  }

  it('StatusDistributionChart does not warn about a -1 x -1 chart size on first render', () => {
    mockMeasuredContainer();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <div style={{ height: 300 }}>
        <StatusDistributionChart data={{ pending: 3, completed: 10, deadletter: 2 }} />
      </div>
    );
    expect(sizeWarnings(warn)).toEqual([]);
  });

  it('StatusDistributionChart shows the empty state without data', () => {
    render(<StatusDistributionChart data={{ pending: 0 }} />);
    expect(screen.getByText('No status data available')).toBeInTheDocument();
  });

  it('trend charts do not warn about their size on first render', () => {
    mockMeasuredContainer();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const t = Date.now();
    render(
      <div>
        <BacklogTrendChart
          height={180}
          data={[
            { timestamp: t - 60_000, pending: 1, processing: 0, total: 1 },
            { timestamp: t, pending: 2, processing: 1, total: 3 },
          ]}
        />
        <WorkerTrendChart
          height={180}
          data={[
            { timestamp: t - 60_000, active: 1, idle: 0, total: 1 },
            { timestamp: t, active: 2, idle: 1, total: 3 },
          ]}
        />
        <FailureTrendChart
          height={180}
          data={[
            { timestamp: t - 60_000, failed: 0, deadletter: 0 },
            { timestamp: t, failed: 1, deadletter: 2 },
          ]}
        />
      </div>
    );
    expect(sizeWarnings(warn)).toEqual([]);
  });
});
