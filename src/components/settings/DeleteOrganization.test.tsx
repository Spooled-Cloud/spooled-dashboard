import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { render, screen, waitFor, within, mockAuthenticatedState } from '@/test/utils';
import { server } from '@/test/mocks/server';
import { queryClient } from '@/lib/query-client';
import { mockOrganization } from '@/test/mocks/handlers';
import { APIError } from '@/lib/api/client';
import { useAuthStore } from '@/stores/auth';
import type { Organization } from '@/lib/types';
import {
  DeleteOrganizationSection,
  OrganizationSettingsPage,
  describeDeleteOrganizationError,
} from './OrganizationSettings';

vi.mock('sonner', async (importOriginal) => {
  const actual = await importOriginal<typeof import('sonner')>();
  return {
    ...actual,
    toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
  };
});

// Deleting the organization signs the user out and leaves for the login page.
const mockLocation = { href: '', pathname: '/settings/organization', search: '', hash: '' };
Object.defineProperty(window, 'location', { value: mockLocation, writable: true });

const API_BASE = 'https://api.spooled.cloud';
// Built from parts so secret scanners do not flag a fixture as a real webhook token.
const WEBHOOK_TOKEN = ['whk', 'fixture', 'token'].join('_');
const org = mockOrganization as unknown as Organization;

function failDelete(status: number, code: string, message: string) {
  server.use(
    http.delete(`${API_BASE}/api/v1/organizations/:id`, () =>
      HttpResponse.json({ code, message }, { status })
    )
  );
}

async function openConfirm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Delete organization' }));
  return screen.findByRole('alertdialog');
}

describe('DeleteOrganizationSection', () => {
  beforeEach(async () => {
    await mockAuthenticatedState();
    queryClient.clear();
    mockLocation.href = '';
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
  });

  it('says what stands in the way, before anyone clicks', () => {
    render(<DeleteOrganizationSection org={org} />);
    const card = screen.getByTestId('delete-organization');

    expect(within(card).getByText(/cannot be undone/i)).toBeInTheDocument();
    expect(
      within(card).getByText(/active jobs \(pending, scheduled or processing\)/i)
    ).toBeInTheDocument();
    expect(within(card).getByText(/registered workers that are not offline/i)).toBeInTheDocument();
    expect(within(card).getByText(/active schedules/i)).toBeInTheDocument();
    expect(within(card).getByText(/subscription is canceled first/i)).toBeInTheDocument();
  });

  it('needs the organization slug typed exactly before it can be confirmed', async () => {
    const user = userEvent.setup();
    render(<DeleteOrganizationSection org={org} />);
    const dialog = await openConfirm(user);

    const confirm = within(dialog).getByRole('button', { name: 'Delete organization' });
    expect(confirm).toBeDisabled();

    const input = within(dialog).getByLabelText(/to confirm/i);
    await user.type(input, 'test-or');
    expect(confirm).toBeDisabled();
    await user.clear(input);
    await user.type(input, 'TEST-ORG');
    expect(confirm).toBeDisabled();
    await user.clear(input);
    await user.type(input, 'test-org');
    expect(confirm).toBeEnabled();
  });

  it('does not call the API until the typed confirmation is complete', async () => {
    let calls = 0;
    server.use(
      http.delete(`${API_BASE}/api/v1/organizations/:id`, () => {
        calls += 1;
        return new HttpResponse(null, { status: 204 });
      })
    );
    const user = userEvent.setup();
    render(<DeleteOrganizationSection org={org} />);
    const dialog = await openConfirm(user);
    await user.type(within(dialog).getByLabelText(/to confirm/i), 'test-org');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(calls).toBe(0);
  });

  it('deletes the organization, signs out and leaves for the login page', async () => {
    let deleted: string | undefined;
    server.use(
      http.delete(`${API_BASE}/api/v1/organizations/:id`, ({ params }) => {
        deleted = String(params.id);
        return new HttpResponse(null, { status: 204 });
      })
    );
    const user = userEvent.setup();
    render(<DeleteOrganizationSection org={org} />);
    const dialog = await openConfirm(user);
    await user.type(within(dialog).getByLabelText(/to confirm/i), 'test-org');
    await user.click(within(dialog).getByRole('button', { name: 'Delete organization' }));

    await waitFor(() => expect(deleted).toBe('org-1'));
    await waitFor(() => expect(mockLocation.href).toBe('/'));
    expect(toast.success).toHaveBeenCalledWith('Organization deleted', {
      description: 'You have been signed out.',
    });
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it('shows why the backend refused (409: active jobs), keeps the session and does not leave', async () => {
    failDelete(
      409,
      'CONFLICT',
      'Cannot delete organization with 3 active jobs. Cancel or complete all jobs first.'
    );
    const user = userEvent.setup();
    render(<DeleteOrganizationSection org={org} />);
    const dialog = await openConfirm(user);
    await user.type(within(dialog).getByLabelText(/to confirm/i), 'test-org');
    await user.click(within(dialog).getByRole('button', { name: 'Delete organization' }));

    const alert = await screen.findByTestId('delete-organization-error');
    expect(alert).toHaveTextContent(
      'Cannot delete organization with 3 active jobs. Cancel or complete all jobs first.'
    );
    // The dialog closed so the reason is readable; the user is still signed in
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(mockLocation.href).toBe('');
    expect(toast.success).not.toHaveBeenCalled();
  });

  it.each([
    ['workers', 'Cannot delete organization with 2 active workers. Deregister all workers first.'],
    [
      'schedules',
      'Cannot delete organization with 1 active schedules. Pause or delete schedules first.',
    ],
    [
      'the subscription',
      "The organization's subscription could not be canceled, so nothing was deleted. Try again, or cancel the subscription in the billing portal first.",
    ],
  ])('shows the 409 reason about %s as the backend words it', async (_what, message) => {
    failDelete(409, 'CONFLICT', message);
    const user = userEvent.setup();
    render(<DeleteOrganizationSection org={org} />);
    const dialog = await openConfirm(user);
    await user.type(within(dialog).getByLabelText(/to confirm/i), 'test-org');
    await user.click(within(dialog).getByRole('button', { name: 'Delete organization' }));

    expect(await screen.findByTestId('delete-organization-error')).toHaveTextContent(message);
  });

  it('explains a refusal for a queue-scoped key (403)', async () => {
    failDelete(403, 'ACCESS_DENIED', 'Queue-scoped API keys cannot delete the organization');
    const user = userEvent.setup();
    render(<DeleteOrganizationSection org={org} />);
    const dialog = await openConfirm(user);
    await user.type(within(dialog).getByLabelText(/to confirm/i), 'test-org');
    await user.click(within(dialog).getByRole('button', { name: 'Delete organization' }));

    expect(await screen.findByTestId('delete-organization-error')).toHaveTextContent(
      /only an unrestricted api key can delete the organization/i
    );
  });

  it('clears an earlier refusal when the dialog is opened again', async () => {
    failDelete(409, 'CONFLICT', 'Cannot delete organization with 3 active jobs.');
    const user = userEvent.setup();
    render(<DeleteOrganizationSection org={org} />);
    let dialog = await openConfirm(user);
    await user.type(within(dialog).getByLabelText(/to confirm/i), 'test-org');
    await user.click(within(dialog).getByRole('button', { name: 'Delete organization' }));
    await screen.findByTestId('delete-organization-error');

    dialog = await openConfirm(user);
    expect(screen.queryByTestId('delete-organization-error')).not.toBeInTheDocument();
    expect(dialog).toBeInTheDocument();
  });
});

describe('describeDeleteOrganizationError', () => {
  it('words 403 and 404, and passes a 409 message through', () => {
    expect(describeDeleteOrganizationError(new APIError(403, 'ACCESS_DENIED', 'x'))).toMatch(
      /unrestricted api key/i
    );
    expect(describeDeleteOrganizationError(new APIError(404, 'NOT_FOUND', 'x'))).toMatch(
      /no longer exists/i
    );
    expect(describeDeleteOrganizationError(new APIError(409, 'CONFLICT', 'still 2 workers'))).toBe(
      'still 2 workers'
    );
  });

  it('falls back to the error message, or a generic one', () => {
    expect(describeDeleteOrganizationError(new Error('Network request failed'))).toBe(
      'Network request failed'
    );
    expect(describeDeleteOrganizationError('boom')).toBe('The organization could not be deleted.');
  });
});

describe('OrganizationSettingsPage danger zone', () => {
  beforeEach(async () => {
    await mockAuthenticatedState();
    queryClient.clear();
  });

  it('is offered to an unrestricted key', async () => {
    render(<OrganizationSettingsPage />);
    expect(await screen.findByTestId('delete-organization')).toBeInTheDocument();
  });

  it('is not offered to a queue-scoped key (the backend would answer 403)', async () => {
    const user = useAuthStore.getState().user!;
    useAuthStore.setState({ user: { ...user, queues: ['emails'] } });
    render(<OrganizationSettingsPage />);

    await screen.findByText('Organization Details');
    await screen.findByText('Test Organization', { selector: 'p' });
    expect(screen.queryByTestId('delete-organization')).not.toBeInTheDocument();
  });

  it('links the incoming webhook section to the log', async () => {
    server.use(
      http.get(`${API_BASE}/api/v1/organizations/webhook-token`, () =>
        HttpResponse.json({
          webhook_url: 'https://api.spooled.cloud/api/v1/webhooks/org-1/custom',
          webhook_token: WEBHOOK_TOKEN,
        })
      )
    );
    render(<OrganizationSettingsPage />);
    const link = await screen.findByRole('link', { name: /see the incoming webhook log/i });
    expect(link).toHaveAttribute('href', '/settings/webhooks#incoming-webhook-log');
  });
});
