/**
 * Tests for Queues API
 */

import { describe, it, expect } from 'vitest';
import { queuesAPI } from './queues';

describe('queuesAPI', () => {
  describe('list', () => {
    it('should fetch queues list', async () => {
      const queues = await queuesAPI.list();
      expect(queues).toBeDefined();
      expect(Array.isArray(queues)).toBe(true);
      expect(queues.length).toBeGreaterThan(0);
    });

    it('should return queue objects with expected properties', async () => {
      const queues = await queuesAPI.list();
      const queue = queues[0];
      expect(queue.name).toBeDefined();
      expect(queue.concurrency).toBeDefined();
      expect(queue.max_retries).toBeDefined();
    });
  });

  describe('get', () => {
    it('should fetch a single queue by name', async () => {
      const queue = await queuesAPI.get('default');
      expect(queue).toBeDefined();
      expect(queue.name).toBe('default');
      expect(queue.concurrency).toBeDefined();
    });

    it('should throw error for non-existent queue', async () => {
      await expect(queuesAPI.get('non-existent')).rejects.toThrow();
    });
  });

  describe('create', () => {
    it('should create a new queue', async () => {
      const newQueue = await queuesAPI.create({
        name: 'test-queue',
        description: 'A test queue',
        concurrency: 5,
      });

      expect(newQueue).toBeDefined();
      expect(newQueue.name).toBe('test-queue');
      expect(newQueue.concurrency).toBe(5);
    });

    it('should create queue with all optional parameters', async () => {
      const newQueue = await queuesAPI.create({
        name: 'full-queue',
        description: 'Full config queue',
        concurrency: 10,
        max_retries: 5,
        retry_delay_ms: 2000,
        backoff_multiplier: 2,
        max_retry_delay_ms: 30000,
        job_timeout_ms: 120000,
      });

      expect(newQueue).toBeDefined();
      expect(newQueue.name).toBe('full-queue');
    });
  });

  describe('update', () => {
    it('should update a queue', async () => {
      const updated = await queuesAPI.update('default', {
        concurrency: 20,
      });

      expect(updated).toBeDefined();
      expect(updated.concurrency).toBe(20);
    });

    it('should update queue with multiple fields', async () => {
      const updated = await queuesAPI.update('default', {
        concurrency: 15,
        description: 'Updated description',
        max_retries: 5,
      });

      expect(updated).toBeDefined();
      expect(updated.concurrency).toBeDefined();
    });
  });

  describe('delete', () => {
    it('should delete a queue', async () => {
      const result = await queuesAPI.delete('test-queue');
      expect(result).toBeUndefined(); // 204 No Content
    });
  });

  describe('pause', () => {
    it('should pause a queue', async () => {
      const result = await queuesAPI.pause('default');
      expect(result).toBeDefined();
      expect(result.paused).toBe(true);
    });
  });

  describe('resume', () => {
    it('should resume a queue', async () => {
      const result = await queuesAPI.resume('default');
      expect(result).toBeDefined();
      expect(result.paused).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should fetch queue statistics', async () => {
      const stats = await queuesAPI.getStats('default');
      expect(stats).toBeDefined();
      expect(stats.name).toBe('default');
      expect(stats.pending).toBeDefined();
      expect(stats.processing).toBeDefined();
      expect(stats.completed).toBeDefined();
      expect(stats.failed).toBeDefined();
    });
  });

  describe('purge', () => {
    it('should purge all jobs from a queue', async () => {
      const result = await queuesAPI.purge('default');
      expect(result).toBeDefined();
      expect(result.deleted).toBeDefined();
      expect(typeof result.deleted).toBe('number');
    });
  });
});
