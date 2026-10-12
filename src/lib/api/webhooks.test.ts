/**
 * Tests for Webhooks API Module
 */

import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { APIError } from './client';
import {
  webhooksAPI,
  inboundWebhooksAPI,
  WEBHOOK_EVENTS,
  WEBHOOK_FORMATS,
  webhookFormatLabel,
} from './webhooks';

const API_BASE = 'https://api.spooled.cloud';

/** `VALID_WEBHOOK_EVENTS` of backend 0.1.122 (src/models/webhook.rs). */
const BACKEND_EVENTS = [
  'job.created',
  'job.started',
  'job.completed',
  'job.failed',
  'job.cancelled',
  'queue.paused',
  'queue.resumed',
  'worker.registered',
  'worker.deregistered',
  'schedule.triggered',
  'job.deadlettered',
  'job.retried',
  'workflow.completed',
  'workflow.failed',
];

describe('webhooksAPI', () => {
  describe('list', () => {
    it('should list all webhooks', async () => {
      const webhooks = await webhooksAPI.list();

      expect(Array.isArray(webhooks)).toBe(true);
      expect(webhooks.length).toBeGreaterThan(0);
    });

    it('should return webhooks with required fields', async () => {
      const webhooks = await webhooksAPI.list();
      const webhook = webhooks[0];

      expect(webhook).toHaveProperty('id');
      expect(webhook).toHaveProperty('name');
      expect(webhook).toHaveProperty('url');
      expect(webhook).toHaveProperty('events');
      expect(webhook).toHaveProperty('enabled');
    });
  });

  describe('create', () => {
    it('should create a new webhook', async () => {
      const webhook = await webhooksAPI.create({
        name: 'New Webhook',
        url: 'https://example.com/webhook',
        events: ['job.completed', 'job.failed'],
      });

      expect(webhook).toHaveProperty('id');
      expect(webhook.name).toBe('New Webhook');
    });
  });

  describe('get', () => {
    it('should get a single webhook by id', async () => {
      const webhook = await webhooksAPI.get('webhook-1');

      expect(webhook).toHaveProperty('id');
      expect(webhook.id).toBe('webhook-1');
    });
  });

  describe('update', () => {
    it('should update an existing webhook', async () => {
      const webhook = await webhooksAPI.update('webhook-1', {
        name: 'Updated Webhook',
      });

      expect(webhook).toHaveProperty('id');
      expect(webhook.name).toBe('Updated Webhook');
    });
  });

  describe('delete', () => {
    it('should delete a webhook', async () => {
      await expect(webhooksAPI.delete('webhook-1')).resolves.not.toThrow();
    });
  });

  describe('test', () => {
    it('should test a webhook', async () => {
      const result = await webhooksAPI.test('webhook-1');

      expect(result).toHaveProperty('success');
      expect(result.success).toBe(true);
    });
  });

  describe('getDeliveries', () => {
    it('should get webhook delivery history', async () => {
      const deliveries = await webhooksAPI.getDeliveries('webhook-1');

      expect(Array.isArray(deliveries)).toBe(true);
    });
  });

  describe('events and formats', () => {
    it('offers exactly the events the backend accepts, including the four added in 0.1.122', () => {
      expect(WEBHOOK_EVENTS.map((e) => e.value).sort()).toEqual([...BACKEND_EVENTS].sort());
      for (const event of [
        'job.deadlettered',
        'job.retried',
        'workflow.completed',
        'workflow.failed',
      ]) {
        const entry = WEBHOOK_EVENTS.find((e) => e.value === event);
        expect(entry?.label).toBeTruthy();
        expect(entry?.description).toBeTruthy();
      }
    });

    it('offers exactly the formats the backend accepts, JSON first', () => {
      expect(WEBHOOK_FORMATS.map((f) => f.value)).toEqual(['json', 'slack', 'discord', 'teams']);
      expect(webhookFormatLabel('teams')).toBe('Microsoft Teams');
      expect(webhookFormatLabel('slack')).toBe('Slack');
      // A format a newer backend adds is shown as it is
      expect(webhookFormatLabel('mattermost')).toBe('mattermost');
    });

    it('returns the format on a listed webhook', async () => {
      const [webhook] = await webhooksAPI.list();
      expect(webhook.format).toBe('slack');
    });

    it('sends the format on create and on update', async () => {
      const bodies: Array<Record<string, unknown>> = [];
      server.use(
        http.post(`${API_BASE}/api/v1/outgoing-webhooks`, async ({ request }) => {
          bodies.push((await request.json()) as Record<string, unknown>);
          return HttpResponse.json({ id: 'w', format: 'discord' }, { status: 201 });
        }),
        http.put(`${API_BASE}/api/v1/outgoing-webhooks/:id`, async ({ request }) => {
          bodies.push((await request.json()) as Record<string, unknown>);
          return HttpResponse.json({ id: 'w', format: 'teams' });
        })
      );

      await webhooksAPI.create({
        name: 'n',
        url: 'https://example.com',
        events: ['workflow.failed'],
        format: 'discord',
      });
      await webhooksAPI.update('w', { format: 'teams' });

      expect(bodies[0]).toMatchObject({ format: 'discord', events: ['workflow.failed'] });
      expect(bodies[1]).toEqual({ format: 'teams' });
    });
  });

  describe('retryDelivery', () => {
    it('posts to the delivery and returns the outcome', async () => {
      const result = await webhooksAPI.retryDelivery('webhook-1', 'delivery-2');
      expect(result).toEqual({ success: true, message: 'Delivery retried successfully' });
    });

    it('returns success false when the endpoint still refuses (HTTP 200)', async () => {
      server.use(
        http.post(`${API_BASE}/api/v1/outgoing-webhooks/:id/retry/:deliveryId`, () =>
          HttpResponse.json({
            success: false,
            message: 'Delivery retry attempted but target did not return success',
          })
        )
      );
      const result = await webhooksAPI.retryDelivery('webhook-1', 'delivery-2');
      expect(result.success).toBe(false);
    });

    it('rejects with the backend reason when the retry is refused (400)', async () => {
      const error = await webhooksAPI
        .retryDelivery('webhook-1', 'delivery-1')
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(APIError);
      expect((error as APIError).status).toBe(400);
      expect((error as APIError).message).toBe('Cannot retry a successful delivery');
    });
  });
});

describe('inboundWebhooksAPI.listDeliveries', () => {
  it('lists the inbound webhook log, newest first', async () => {
    const rows = await inboundWebhooksAPI.listDeliveries();
    expect(rows.map((r) => r.id)).toEqual(['inbound-3', 'inbound-2', 'inbound-1']);
    expect(rows[0]).toEqual({
      id: 'inbound-3',
      provider: 'custom',
      event_type: 'order.created',
      matched_queue: 'orders',
      job_id: 'job-in-3',
      status: 'created',
      created_at: '2026-10-11T12:00:00Z',
    });
  });

  it('maps entries from before 0.1.122 (no job, no outcome) to nulls', async () => {
    server.use(
      http.get(`${API_BASE}/api/v1/webhooks/deliveries`, () =>
        HttpResponse.json([
          {
            id: 'old',
            provider: 'custom',
            event_type: 'custom',
            matched_queue: null,
            created_at: '2026-10-01T00:00:00Z',
          },
        ])
      )
    );
    const [row] = await inboundWebhooksAPI.listDeliveries();
    expect(row.job_id).toBeNull();
    expect(row.status).toBeNull();
    expect(row.matched_queue).toBeNull();
  });

  it('sends status, since, queue_name, limit and offset', async () => {
    let seen: URLSearchParams | undefined;
    server.use(
      http.get(`${API_BASE}/api/v1/webhooks/deliveries`, ({ request }) => {
        seen = new URL(request.url).searchParams;
        return HttpResponse.json([]);
      })
    );

    await inboundWebhooksAPI.listDeliveries({
      status: 'duplicate',
      since: '2026-10-11T00:00:00.000Z',
      queue_name: 'orders',
      limit: 26,
      offset: 25,
    });

    expect(seen?.get('status')).toBe('duplicate');
    expect(seen?.get('since')).toBe('2026-10-11T00:00:00.000Z');
    expect(seen?.get('queue_name')).toBe('orders');
    expect(seen?.get('limit')).toBe('26');
    expect(seen?.get('offset')).toBe('25');
  });

  it('is filtered by the mock backend like the real one', async () => {
    expect(
      (await inboundWebhooksAPI.listDeliveries({ status: 'duplicate' })).map((r) => r.id)
    ).toEqual(['inbound-2']);
    expect(
      (await inboundWebhooksAPI.listDeliveries({ queue_name: 'orders', limit: 1, offset: 1 })).map(
        (r) => r.id
      )
    ).toEqual(['inbound-2']);
    expect(
      (await inboundWebhooksAPI.listDeliveries({ since: '2026-10-11T11:30:00Z' })).map((r) => r.id)
    ).toEqual(['inbound-3']);
  });

  it('rejects with 403 for a queue-scoped key', async () => {
    server.use(
      http.get(`${API_BASE}/api/v1/webhooks/deliveries`, () =>
        HttpResponse.json(
          {
            code: 'ACCESS_DENIED',
            message: 'Queue-scoped API keys cannot read the inbound webhook log',
          },
          { status: 403 }
        )
      )
    );
    const error = await inboundWebhooksAPI.listDeliveries().catch((e: unknown) => e);
    expect((error as APIError).isForbidden()).toBe(true);
  });
});
