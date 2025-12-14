/**
 * Tests for Schedules API Module
 */

import { describe, it, expect } from 'vitest';
import { schedulesAPI } from './schedules';

describe('schedulesAPI', () => {
  describe('list', () => {
    it('should list all schedules', async () => {
      const schedules = await schedulesAPI.list();

      expect(Array.isArray(schedules)).toBe(true);
      expect(schedules.length).toBeGreaterThan(0);
    });

    it('should return schedules with required fields', async () => {
      const schedules = await schedulesAPI.list();
      const schedule = schedules[0];

      expect(schedule).toHaveProperty('id');
      expect(schedule).toHaveProperty('name');
      expect(schedule).toHaveProperty('cron_expression');
      expect(schedule).toHaveProperty('enabled');
    });
  });

  describe('get', () => {
    it('should get a single schedule by id', async () => {
      const schedule = await schedulesAPI.get('schedule-1');

      expect(schedule).toHaveProperty('id');
      expect(schedule.id).toBe('schedule-1');
    });
  });

  describe('create', () => {
    it('should create a new schedule', async () => {
      const schedule = await schedulesAPI.create({
        name: 'New Schedule',
        cron_expression: '0 * * * *',
        queue_name: 'default',
        job_type: 'scheduled_task',
        payload: { key: 'value' },
      });

      expect(schedule).toHaveProperty('id');
      expect(schedule.name).toBe('New Schedule');
    });
  });

  describe('update', () => {
    it('should update an existing schedule', async () => {
      const schedule = await schedulesAPI.update('schedule-1', {
        name: 'Updated Schedule',
      });

      expect(schedule).toHaveProperty('id');
      expect(schedule.name).toBe('Updated Schedule');
    });
  });

  describe('delete', () => {
    it('should delete a schedule', async () => {
      await expect(schedulesAPI.delete('schedule-1')).resolves.not.toThrow();
    });
  });

  describe('trigger', () => {
    it('should trigger a schedule manually', async () => {
      const result = await schedulesAPI.trigger('schedule-1');

      expect(result).toHaveProperty('job_id');
    });
  });

  describe('pause', () => {
    it('should pause a schedule', async () => {
      const schedule = await schedulesAPI.pause('schedule-1');

      expect(schedule).toHaveProperty('id');
      expect(schedule.enabled).toBe(false);
    });
  });

  describe('resume', () => {
    it('should resume a schedule', async () => {
      const schedule = await schedulesAPI.resume('schedule-1');

      expect(schedule).toHaveProperty('id');
      expect(schedule.enabled).toBe(true);
    });
  });

  describe('getHistory', () => {
    it('should get schedule execution history', async () => {
      const history = await schedulesAPI.getHistory('schedule-1');

      expect(Array.isArray(history)).toBe(true);
    });
  });
});
