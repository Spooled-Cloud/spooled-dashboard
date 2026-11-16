/**
 * `GET /workflows` defaults to 50 rows and `GET /schedules` to 100, newest first, with no
 * total. The lists page through limit/offset so older rows do not silently disappear.
 */

import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { fetchAllPages } from './paging';
import { workflowsAPI, WORKFLOWS_PAGE_SIZE } from './workflows';
import { schedulesAPI, SCHEDULES_PAGE_SIZE } from './schedules';

const API_BASE = 'https://api.spooled.cloud';

/** A backend list that honours limit/offset with its own default and maximum page size. */
function pagedList<T>(rows: T[], defaultLimit: number, maxLimit: number) {
  const requests: Array<{ limit: string | null; offset: string | null }> = [];
  const resolver = ({ request }: { request: Request }) => {
    const url = new URL(request.url);
    requests.push({ limit: url.searchParams.get('limit'), offset: url.searchParams.get('offset') });
    const limit = Math.min(Number(url.searchParams.get('limit') ?? defaultLimit), maxLimit);
    const offset = Number(url.searchParams.get('offset') ?? 0);
    return HttpResponse.json(rows.slice(offset, offset + limit));
  };
  return { requests, resolver };
}

function workflow(i: number) {
  return {
    id: `wf-${i}`,
    name: `Workflow ${i}`,
    status: 'completed',
    total_jobs: 1,
    completed_jobs: 1,
    failed_jobs: 0,
    created_at: '2026-11-01T00:00:00Z',
  };
}

function schedule(i: number) {
  return {
    id: `sch-${i}`,
    organization_id: 'org-1',
    name: `Schedule ${i}`,
    cron_expression: '0 * * * *',
    timezone: 'UTC',
    queue_name: 'default',
    payload_template: { job_type: 'tick' },
    is_active: true,
    created_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-01T00:00:00Z',
  };
}

describe('workflowsAPI.list paging', () => {
  it('returns every workflow, not the newest 50', async () => {
    const all = Array.from({ length: 230 }, (_, i) => workflow(i));
    const backend = pagedList(all, 50, 100);
    server.use(http.get(`${API_BASE}/api/v1/workflows`, backend.resolver));

    const result = await workflowsAPI.list();

    expect(result).toHaveLength(230);
    expect(result[229].id).toBe('wf-229');
    expect(backend.requests).toEqual([
      { limit: String(WORKFLOWS_PAGE_SIZE), offset: '0' },
      { limit: String(WORKFLOWS_PAGE_SIZE), offset: '100' },
      { limit: String(WORKFLOWS_PAGE_SIZE), offset: '200' },
    ]);
  });
});

describe('schedulesAPI.list paging', () => {
  it('returns every schedule, not the newest 100', async () => {
    const all = Array.from({ length: 640 }, (_, i) => schedule(i));
    const backend = pagedList(all, 100, 500);
    server.use(http.get(`${API_BASE}/api/v1/schedules`, backend.resolver));

    const result = await schedulesAPI.list();

    expect(result).toHaveLength(640);
    expect(result[639].id).toBe('sch-639');
    expect(backend.requests.map((r) => r.offset)).toEqual(['0', String(SCHEDULES_PAGE_SIZE)]);
  });
});

describe('fetchAllPages', () => {
  it('stops when a server ignores offset and repeats the first page', async () => {
    let calls = 0;
    const rows = await fetchAllPages(
      async (limit) => {
        calls++;
        return Array.from({ length: limit }, (_, i) => ({ id: `r-${i}` }));
      },
      (row) => row.id,
      10,
      50
    );
    expect(rows).toHaveLength(10);
    expect(calls).toBe(2);
  });

  it('drops a row repeated across pages and keeps the rest', async () => {
    const pages = [[{ id: 'a' }, { id: 'b' }], [{ id: 'b' }, { id: 'c' }], [{ id: 'd' }]];
    let page = 0;
    const rows = await fetchAllPages(
      async () => pages[page++] ?? [],
      (row) => row.id,
      2,
      50
    );
    expect(rows.map((r) => r.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('never asks for more than maxPages pages', async () => {
    let calls = 0;
    await fetchAllPages(
      async (limit, offset) => {
        calls++;
        return Array.from({ length: limit }, (_, i) => ({ id: `r-${offset + i}` }));
      },
      (row) => row.id,
      5,
      3
    );
    expect(calls).toBe(3);
  });
});
