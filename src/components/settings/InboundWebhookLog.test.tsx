import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor, within, mockAuthenticatedState } from '@/test/utils';
import { server } from '@/test/mocks/server';
import { useAuthStore } from '@/stores/auth';
import { InboundWebhookLog, INBOUND_LOG_PAGE_SIZE } from './InboundWebhookLog';

const URL_PATTERN = 'https://api.spooled.cloud/api/v1/webhooks/deliveries';

function entry(i: number) {
  return {
    id: `inbound-${i}`,
    provider: 'custom',
    event_type: `event.${i}`,
    matched_queue: 'orders',
    job_id: `job-in-${i}`,
    status: 'created',
    created_at: '2026-10-11T12:00:00Z',
  };
}

describe('InboundWebhookLog', () => {
  beforeEach(async () => {
    await mockAuthenticatedState();
  });

  it('lists the requests Spooled accepted, with the job each one created', async () => {
    render(<InboundWebhookLog />);

    const log = await screen.findByTestId('inbound-webhook-log');
    expect(within(log).getByText('Incoming webhook log')).toBeInTheDocument();
    const rows = await within(log).findAllByRole('row');
    // header + 3 entries
    expect(rows).toHaveLength(4);

    const newest = rows[1];
    expect(within(newest).getByText('order.created')).toBeInTheDocument();
    expect(within(newest).getByText('orders')).toBeInTheDocument();
    expect(within(newest).getByRole('link', { name: 'job-in-3' })).toHaveAttribute(
      'href',
      '/jobs/job-in-3'
    );
    expect(within(newest).getByText('Created')).toBeInTheDocument();

    expect(within(rows[2]).getByText('Duplicate')).toBeInTheDocument();
  });

  it('shows entries from before 0.1.122 (no job, no outcome) with dashes', async () => {
    render(<InboundWebhookLog />);
    const rows = await screen.findAllByRole('row');
    const legacy = rows[3];

    expect(within(legacy).getByText('custom')).toBeInTheDocument();
    expect(within(legacy).queryByRole('link')).not.toBeInTheDocument();
    expect(within(legacy).queryByText('Created')).not.toBeInTheDocument();
    expect(within(legacy).queryByText('Duplicate')).not.toBeInTheDocument();
    expect(within(legacy).getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });

  it('never shows a payload or signature column', async () => {
    render(<InboundWebhookLog />);
    await screen.findAllByRole('row');
    expect(screen.queryByText(/payload/i, { selector: 'th' })).not.toBeInTheDocument();
    expect(screen.queryByText(/signature/i)).not.toBeInTheDocument();
  });

  it('filters by outcome, by time and by queue on the server', async () => {
    const queries: URLSearchParams[] = [];
    server.use(
      http.get(URL_PATTERN, ({ request }) => {
        queries.push(new URL(request.url).searchParams);
        return HttpResponse.json([]);
      })
    );
    const user = userEvent.setup();
    render(<InboundWebhookLog />);
    await waitFor(() => expect(queries.length).toBeGreaterThan(0));

    await user.selectOptions(screen.getByLabelText('Outcome'), 'duplicate');
    await waitFor(() => expect(queries.at(-1)?.get('status')).toBe('duplicate'));

    const before = Date.now();
    await user.selectOptions(screen.getByLabelText('Received'), '24h');
    await waitFor(() => expect(queries.at(-1)?.get('since')).toBeTruthy());
    const since = Date.parse(queries.at(-1)?.get('since') ?? '');
    expect(Math.abs(before - 24 * 3600 * 1000 - since)).toBeLessThan(5000);

    await user.type(screen.getByLabelText('Queue'), 'orders');
    await waitFor(() => expect(queries.at(-1)?.get('queue_name')).toBe('orders'), {
      timeout: 3000,
    });
    // A new filter starts again at the first page
    expect(queries.at(-1)?.get('offset')).toBe('0');
  });

  it('filters the mock backend: only duplicates', async () => {
    const user = userEvent.setup();
    render(<InboundWebhookLog />);
    await screen.findAllByRole('row');

    await user.selectOptions(screen.getByLabelText('Outcome'), 'duplicate');

    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(2));
    expect(screen.getByText('Duplicate', { selector: 'div' })).toBeInTheDocument();
  });

  it('pages with Previous and Next using limit and offset, no total', async () => {
    const offsets: number[] = [];
    const all = Array.from({ length: INBOUND_LOG_PAGE_SIZE + 5 }, (_, i) => entry(i));
    server.use(
      http.get(URL_PATTERN, ({ request }) => {
        const url = new URL(request.url);
        const limit = Number(url.searchParams.get('limit'));
        const offset = Number(url.searchParams.get('offset'));
        offsets.push(offset);
        return HttpResponse.json(all.slice(offset, offset + limit));
      })
    );
    const user = userEvent.setup();
    render(<InboundWebhookLog />);

    expect(await screen.findByText('event.0')).toBeInTheDocument();
    // 25 rows are shown; the 26th was only fetched to learn that a next page exists
    expect(screen.getByText('event.24')).toBeInTheDocument();
    expect(screen.queryByText('event.25')).not.toBeInTheDocument();
    expect(screen.getByText('Page 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /next/i }));

    expect(await screen.findByText('event.25')).toBeInTheDocument();
    expect(screen.queryByText('event.0')).not.toBeInTheDocument();
    expect(offsets).toContain(INBOUND_LOG_PAGE_SIZE);
    expect(screen.getByText('Page 2 (last page)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /previous/i }));
    expect(await screen.findByText('event.0')).toBeInTheDocument();
  });

  it('says so when nothing has arrived, and when no entry matches the filters', async () => {
    server.use(http.get(URL_PATTERN, () => HttpResponse.json([])));
    const user = userEvent.setup();
    render(<InboundWebhookLog />);

    expect(await screen.findByText('No incoming webhook requests')).toBeInTheDocument();
    expect(screen.getByText(/appear here/i)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Outcome'), 'created');
    expect(
      await screen.findByText(/no accepted request matches these filters/i)
    ).toBeInTheDocument();
  });

  it('shows an error with a retry for a failure other than 403/404', async () => {
    server.use(
      http.get(URL_PATTERN, () =>
        HttpResponse.json({ code: 'DATABASE_ERROR', message: 'boom' }, { status: 500 })
      )
    );
    render(<InboundWebhookLog />);
    expect(await screen.findByText('boom')).toBeInTheDocument();
    expect(screen.getByTestId('inbound-webhook-log')).toBeInTheDocument();
  });

  it('is hidden when the backend refuses a queue-scoped key (403)', async () => {
    let calls = 0;
    server.use(
      http.get(URL_PATTERN, () => {
        calls += 1;
        return HttpResponse.json(
          {
            code: 'ACCESS_DENIED',
            message: 'Queue-scoped API keys cannot read the inbound webhook log',
          },
          { status: 403 }
        );
      })
    );
    render(<InboundWebhookLog />);
    await waitFor(() => expect(calls).toBeGreaterThan(0));
    await waitFor(() =>
      expect(screen.queryByTestId('inbound-webhook-log')).not.toBeInTheDocument()
    );
  });

  it('is hidden on a backend without the route (404 before 0.1.122)', async () => {
    let calls = 0;
    server.use(
      http.get(URL_PATTERN, () => {
        calls += 1;
        return HttpResponse.json({ code: 'NOT_FOUND', message: 'Not Found' }, { status: 404 });
      })
    );
    render(<InboundWebhookLog />);
    await waitFor(() => expect(calls).toBeGreaterThan(0));
    await waitFor(() =>
      expect(screen.queryByTestId('inbound-webhook-log')).not.toBeInTheDocument()
    );
  });

  it('is hidden for a queue-scoped session without asking the API at all', async () => {
    let calls = 0;
    server.use(
      http.get(URL_PATTERN, () => {
        calls += 1;
        return HttpResponse.json([]);
      })
    );
    const user = useAuthStore.getState().user!;
    useAuthStore.setState({ user: { ...user, queues: ['emails'] } });

    render(<InboundWebhookLog />);

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(screen.queryByTestId('inbound-webhook-log')).not.toBeInTheDocument();
    expect(calls).toBe(0);
  });
});
