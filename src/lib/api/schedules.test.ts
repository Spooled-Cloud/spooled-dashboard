/**
 * Tests for Schedules API Module
 */

import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { schedulesAPI, isScheduleRunInFlight } from './schedules';

const API_BASE = 'https://api.spooled.cloud';

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

    it('sends non-object payload_template without spreading it into an object', async () => {
      let posted: Record<string, unknown> | undefined;
      server.use(
        http.post(`${API_BASE}/api/v1/schedules`, async ({ request }) => {
          posted = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(
            { id: 'schedule-any-json', name: 'Any JSON', cron_expression: '0 * * * *' },
            { status: 201 }
          );
        }),
        http.get(`${API_BASE}/api/v1/schedules/schedule-any-json`, () =>
          HttpResponse.json({
            id: 'schedule-any-json',
            organization_id: 'org-1',
            name: 'Any JSON',
            cron_expression: '0 * * * *',
            timezone: 'UTC',
            queue_name: 'default',
            payload_template: 'hello',
            priority: 0,
            max_retries: 3,
            timeout_seconds: 300,
            is_active: true,
            run_count: 0,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          })
        )
      );

      await schedulesAPI.create({
        name: 'Any JSON',
        cron_expression: '0 * * * *',
        queue_name: 'default',
        job_type: 'scheduled_task',
        payload: 'hello',
      });
      expect(posted?.payload_template).toBe('hello');
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

    it('maps completed runs to success and keeps failed runs without a job', async () => {
      server.use(
        http.get(`${API_BASE}/api/v1/schedules/:id/history`, () => {
          return HttpResponse.json([
            {
              id: 'run-ok',
              schedule_id: 'schedule-1',
              job_id: 'job-abc',
              status: 'completed',
              error_message: null,
              started_at: '2024-01-01T00:00:00Z',
              completed_at: '2024-01-01T00:00:00Z',
            },
            {
              id: 'run-fail',
              schedule_id: 'schedule-1',
              job_id: null,
              status: 'failed',
              error_message: 'plan limit',
              started_at: '2024-01-01T00:01:00Z',
              completed_at: '2024-01-01T00:01:00Z',
            },
          ]);
        })
      );

      const history = await schedulesAPI.getHistory('schedule-1');

      expect(history).toEqual([
        {
          id: 'run-ok',
          schedule_id: 'schedule-1',
          job_id: 'job-abc',
          status: 'success',
          triggered_at: '2024-01-01T00:00:00Z',
          error: undefined,
        },
        {
          id: 'run-fail',
          schedule_id: 'schedule-1',
          job_id: null,
          status: 'failed',
          triggered_at: '2024-01-01T00:01:00Z',
          error: 'plan limit',
        },
      ]);
    });

    it('keeps pending and running runs apart from success and failure (backend 0.1.125)', async () => {
      const history = await schedulesAPI.getHistory('schedule-1');

      expect(history.map((run) => [run.id, run.status, run.job_status])).toEqual([
        ['run-pending', 'pending', 'pending'],
        ['run-running', 'running', 'processing'],
        ['run-completed', 'success', 'completed'],
        ['run-failed', 'failed', 'deadletter'],
        ['run-not-enqueued', 'failed', undefined],
      ]);
      expect(history.find((run) => run.id === 'run-failed')?.error).toBe('handler exploded');
    });

    it('shows a run as in progress while its job is, whatever status an older backend wrote', async () => {
      const row = (id: string, status: string, job_status: string | null) => ({
        id,
        schedule_id: 'schedule-1',
        job_id: job_status ? `job-${id}` : null,
        status,
        job_status,
        error_message: null,
        started_at: '2024-01-01T00:00:00Z',
        completed_at: null,
      });
      server.use(
        http.get(`${API_BASE}/api/v1/schedules/:id/history`, () =>
          HttpResponse.json([
            // 0.1.124 and older: `completed` the moment the job was enqueued
            row('old-pending', 'completed', 'pending'),
            row('old-scheduled', 'completed', 'scheduled'),
            row('old-running', 'completed', 'processing'),
            row('old-done', 'completed', 'completed'),
            row('old-no-job-status', 'completed', null),
            row('legacy-success', 'success', 'completed'),
            row('unknown', 'cancelled', 'cancelled'),
          ])
        )
      );

      const history = await schedulesAPI.getHistory('schedule-1');

      expect(history.map((run) => [run.id, run.status])).toEqual([
        ['old-pending', 'pending'],
        ['old-scheduled', 'pending'],
        ['old-running', 'running'],
        ['old-done', 'success'],
        ['old-no-job-status', 'success'],
        ['legacy-success', 'success'],
        ['unknown', 'failed'],
      ]);
    });
  });

  describe('isScheduleRunInFlight', () => {
    it('is true only for pending and running', () => {
      expect(isScheduleRunInFlight('pending')).toBe(true);
      expect(isScheduleRunInFlight('running')).toBe(true);
      expect(isScheduleRunInFlight('success')).toBe(false);
      expect(isScheduleRunInFlight('failed')).toBe(false);
    });
  });
});
