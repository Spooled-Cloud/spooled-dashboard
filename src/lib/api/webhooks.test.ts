/**
 * Tests for Webhooks API Module
 */

import { describe, it, expect } from 'vitest';
import { webhooksAPI } from './webhooks';

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
});
