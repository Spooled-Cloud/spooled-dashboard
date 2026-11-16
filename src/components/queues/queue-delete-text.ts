/**
 * What deleting a queue really does (`DELETE /queues/{name}`), for the confirm dialogs and toasts.
 *
 * Without `delete_jobs` the backend deletes only the queue's configuration row (settings, pause
 * state), and refuses (409) while the queue has pending, scheduled or processing jobs. Finished
 * jobs (completed, failed, dead-lettered, cancelled) stay, and the queue list keeps showing a
 * queue that still has jobs, with default settings. With `delete_jobs` every job of the queue,
 * in any status, is deleted together with the configuration.
 */

export function queueDeleteWarnings(deleteJobs: boolean): string[] {
  return deleteJobs
    ? [
        'Queue configuration will be deleted',
        'All jobs in this queue will be permanently deleted',
        'This includes pending, processing, and completed jobs',
      ]
    : [
        'Only the queue configuration (settings, pause state) will be deleted',
        'Refused while the queue has pending, scheduled or processing jobs',
        'Completed, failed, dead-lettered and cancelled jobs are kept, so the queue stays listed with default settings until they are gone',
      ];
}

export function queueDeletedToast(
  name: string,
  deleteJobs: boolean
): { title: string; description: string } {
  return deleteJobs
    ? { title: 'Queue deleted', description: `Queue "${name}" and its jobs were deleted` }
    : {
        title: 'Queue configuration deleted',
        description: `Finished jobs of "${name}" are kept, so it can still be listed with default settings`,
      };
}
