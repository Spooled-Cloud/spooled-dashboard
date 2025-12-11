/**
 * Tests for Workers API Module
 */

import { describe, it, expect } from 'vitest';
import { workersAPI } from './workers';

describe('workersAPI', () => {
  describe('list', () => {
    it('should list all workers', async () => {
      const workers = await workersAPI.list();

      expect(Array.isArray(workers)).toBe(true);
      expect(workers.length).toBeGreaterThan(0);
    });

    it('should return workers with required fields', async () => {
      const workers = await workersAPI.list();
      const worker = workers[0];

      expect(worker).toHaveProperty('id');
      expect(worker).toHaveProperty('hostname');
      expect(worker).toHaveProperty('status');
    });
  });

  describe('get', () => {
    it('should get a single worker by id', async () => {
      const worker = await workersAPI.get('worker-1');

      expect(worker).toHaveProperty('id');
      expect(worker.id).toBe('worker-1');
    });
  });

  describe('deregister', () => {
    it('should deregister a worker', async () => {
      await expect(workersAPI.deregister('worker-1')).resolves.not.toThrow();
    });
  });
});
