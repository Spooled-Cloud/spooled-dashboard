/**
 * Billing API
 */

import { apiClient } from './client';
import { API_ENDPOINTS } from '@/lib/constants/api';

export interface BillingStatus {
  /** Current plan tier (free, starter, pro, enterprise) */
  plan_tier: string;
  /** Stripe subscription ID (if any) */
  stripe_subscription_id: string | null;
  /** Subscription status (active, past_due, canceled, etc.) */
  stripe_subscription_status: string | null;
  /** Current billing period end date */
  stripe_current_period_end: string | null;
  /** Whether subscription will cancel at period end */
  stripe_cancel_at_period_end: boolean | null;
  /** Whether user has a Stripe customer account */
  has_stripe_customer: boolean;
}

export interface CreatePortalResponse {
  /** URL to redirect the user to Stripe billing portal */
  url: string;
}

export const billingAPI = {
  /**
   * GET /api/v1/billing/status
   * Get current billing/subscription status
   */
  getStatus: (): Promise<BillingStatus> => {
    return apiClient.get<BillingStatus>(API_ENDPOINTS.BILLING.STATUS);
  },

  /**
   * POST /api/v1/billing/portal
   * Create a Stripe billing portal session
   */
  createPortalSession: (returnUrl: string): Promise<CreatePortalResponse> => {
    return apiClient.post<CreatePortalResponse>(API_ENDPOINTS.BILLING.PORTAL, {
      return_url: returnUrl,
    });
  },
};

/**
 * Get display name for plan tier
 */
export function getPlanDisplayName(planTier: string): string {
  const plans: Record<string, string> = {
    free: 'Free',
    starter: 'Starter',
    pro: 'Pro',
    enterprise: 'Enterprise',
  };
  return plans[planTier] || planTier.charAt(0).toUpperCase() + planTier.slice(1);
}

/**
 * Get subscription status display info
 */
export function getSubscriptionStatusInfo(status: string | null): {
  label: string;
  color: 'default' | 'success' | 'warning' | 'destructive';
  description: string;
} {
  switch (status) {
    case 'active':
      return {
        label: 'Active',
        color: 'success',
        description: 'Your subscription is active and in good standing.',
      };
    case 'past_due':
      return {
        label: 'Past Due',
        color: 'warning',
        description: 'Your payment is past due. Please update your payment method.',
      };
    case 'canceled':
      return {
        label: 'Canceled',
        color: 'destructive',
        description: 'Your subscription has been canceled.',
      };
    case 'unpaid':
      return {
        label: 'Unpaid',
        color: 'destructive',
        description: 'Your subscription is unpaid. Please update your payment method.',
      };
    case 'trialing':
      return {
        label: 'Trial',
        color: 'default',
        description: 'Your trial is active.',
      };
    case 'incomplete':
      return {
        label: 'Incomplete',
        color: 'warning',
        description: 'Your subscription setup is incomplete.',
      };
    default:
      return {
        label: 'No Subscription',
        color: 'default',
        description: 'You are on the free plan.',
      };
  }
}
