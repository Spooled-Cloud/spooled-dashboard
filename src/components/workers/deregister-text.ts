/**
 * What deregistering a worker really does (`DELETE /workers/{id}`), for confirms and toasts.
 *
 * The backend marks the worker row offline and returns the jobs whose lease already expired to
 * the queue. It does not stop the worker process or block it: a running worker can still claim
 * jobs, and its next heartbeat sets it back to healthy.
 */

export const DEREGISTER_EFFECT_WARNINGS = [
  'This only marks the worker offline; it does not stop the worker process',
  'A worker that is still running can claim jobs, and its next heartbeat shows it online again',
];

export const DEREGISTER_CONFIRM_TEXT =
  'Deregister this worker? It is marked offline and its jobs with an expired lease return to the queue. ' +
  'This does not stop the worker process: if it is still running, its next heartbeat brings it back online.';

export const DEREGISTERED_TOAST = {
  title: 'Worker marked offline',
  description:
    'If the worker process is still running, its next heartbeat brings it back. Stop the process to take it out of the pool.',
};
