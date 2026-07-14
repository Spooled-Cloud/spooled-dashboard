import { useState } from 'react';
import { ProtectedPage } from '@/components/providers/ProtectedPage';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery, useMutation } from '@tanstack/react-query';
import { billingAPI, getPlanDisplayName, getSubscriptionStatusInfo } from '@/lib/api/billing';
import { formatRelativeTime } from '@/lib/utils/format';
import {
  CreditCard,
  ExternalLink,
  Loader2,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Clock,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';

const PRICING_URL = 'https://spooled.cloud/pricing';

function PlanBadge({ planTier }: { planTier: string }) {
  const isPaid = planTier !== 'free';

  return (
    <Badge
      className={
        isPaid
          ? 'bg-primary/10 border-primary text-primary'
          : 'border-muted-foreground bg-muted text-muted-foreground'
      }
    >
      {isPaid && <Sparkles className="mr-1 h-3 w-3" />}
      {getPlanDisplayName(planTier)}
    </Badge>
  );
}

function SubscriptionStatusBadge({ status }: { status: string | null }) {
  const info = getSubscriptionStatusInfo(status);

  const colorClasses = {
    default: 'border-status-unknown/50 bg-status-unknown/10 text-status-unknown-foreground',
    success: 'border-status-completed/50 bg-status-completed/10 text-status-completed-foreground',
    warning: 'border-status-warning/50 bg-status-warning/10 text-status-warning-foreground',
    destructive: 'border-status-failed/50 bg-status-failed/10 text-status-failed-foreground',
  };

  const icons = {
    default: <Clock className="mr-1 h-3 w-3" />,
    success: <CheckCircle className="mr-1 h-3 w-3" />,
    warning: <AlertCircle className="mr-1 h-3 w-3" />,
    destructive: <AlertCircle className="mr-1 h-3 w-3" />,
  };

  return (
    <Badge className={colorClasses[info.color]}>
      {icons[info.color]}
      {info.label}
    </Badge>
  );
}

function getPlanSummary(billing: {
  plan_tier: string;
  has_stripe_customer: boolean;
  stripe_subscription_status: string | null;
}): string {
  if (!billing.has_stripe_customer) {
    if (billing.plan_tier === 'free') {
      return 'This organization is on the free plan. No Stripe billing account is linked yet.';
    }
    return `Plan tier is ${getPlanDisplayName(billing.plan_tier)}. Billing details will appear here after a Stripe account is linked.`;
  }

  return getSubscriptionStatusInfo(billing.stripe_subscription_status).description;
}

function BillingContent() {
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);

  const {
    data: billing,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['billing', 'status'],
    queryFn: () => billingAPI.getStatus(),
  });

  const portalMutation = useMutation({
    mutationFn: () => {
      const returnUrl = window.location.href;
      return billingAPI.createPortalSession(returnUrl);
    },
    onSuccess: (data) => {
      const opened = window.open(data.url, '_blank', 'noopener,noreferrer');
      if (!opened) {
        toast.error('Popup blocked', {
          description: 'Allow popups for this site to open the Stripe billing portal.',
        });
      }
      setIsOpeningPortal(false);
    },
    onError: (portalError) => {
      setIsOpeningPortal(false);
      toast.error('Failed to open billing portal', {
        description: portalError instanceof Error ? portalError.message : 'An error occurred',
      });
    },
  });

  const handleManageBilling = () => {
    setIsOpeningPortal(true);
    portalMutation.mutate();
  };

  const handleViewPricing = () => {
    window.open(PRICING_URL, '_blank', 'noopener,noreferrer');
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="mb-4 h-12 w-12 text-destructive" />
        <h2 className="mb-2 text-lg font-semibold">Failed to load billing information</h2>
        <p className="text-muted-foreground">
          {error instanceof Error ? error.message : 'An error occurred'}
        </p>
      </div>
    );
  }

  const isPaidPlan = billing?.plan_tier && billing.plan_tier !== 'free';
  const hasStripeCustomer = billing?.has_stripe_customer ?? false;
  const hasSubscription = billing?.stripe_subscription_id;
  const planSummary = billing ? getPlanSummary(billing) : '';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
        <p className="text-muted-foreground">Manage your subscription and billing settings</p>
      </div>

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Current Plan
          </CardTitle>
          <CardDescription>Your current subscription plan and status</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
          ) : billing ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <PlanBadge planTier={billing.plan_tier} />
                {hasSubscription && (
                  <SubscriptionStatusBadge status={billing.stripe_subscription_status} />
                )}
              </div>

              <p className="text-sm text-muted-foreground">{planSummary}</p>

              {hasStripeCustomer && billing.stripe_current_period_end && (
                <div className="bg-muted/50 rounded-lg border p-4">
                  <div className="grid gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Next billing date</span>
                      <span className="font-medium">
                        {new Date(billing.stripe_current_period_end).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Renews in</span>
                      <span className="font-medium">
                        {formatRelativeTime(billing.stripe_current_period_end)}
                      </span>
                    </div>
                    {billing.stripe_cancel_at_period_end && (
                      <div className="border-status-warning/50 bg-status-warning/10 mt-2 flex items-center gap-2 rounded-md border p-2 text-status-warning-foreground">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span className="text-sm">
                          Your subscription will cancel at the end of this billing period
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!hasStripeCustomer && (
                <div className="border-muted-foreground/30 bg-muted/30 rounded-lg border border-dashed p-4">
                  <p className="text-sm text-muted-foreground">
                    Subscribe through spooled.cloud to link a Stripe billing account. Plan limits
                    and pricing are listed on the public pricing page.
                  </p>
                </div>
              )}

              {!isPaidPlan && (
                <div className="border-primary/30 bg-primary/5 rounded-lg border-2 border-dashed p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <Sparkles className="mt-0.5 h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">Need higher limits?</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Compare plans and subscribe on spooled.cloud.
                        </p>
                      </div>
                    </div>
                    <Button onClick={handleViewPricing} size="sm" variant="outline">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      View pricing
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Manage Subscription */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Manage Subscription
          </CardTitle>
          <CardDescription>
            {hasStripeCustomer
              ? 'Open the Stripe billing portal in a new tab to manage payment methods and invoices'
              : 'Billing management becomes available after a Stripe account is linked'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-10 w-40" />
          ) : hasStripeCustomer ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                You will leave this dashboard and open Stripe&apos;s secure billing portal in a new
                tab where you can:
              </p>
              <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                <li>Update your payment method</li>
                <li>View and download invoices</li>
                <li>Change or cancel your subscription</li>
                <li>Update billing information</li>
              </ul>
              <Button
                onClick={handleManageBilling}
                disabled={portalMutation.isPending || isOpeningPortal}
              >
                {portalMutation.isPending || isOpeningPortal ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Opening Stripe portal...
                  </>
                ) : (
                  <>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open Stripe billing portal (new tab)
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This organization does not have a linked Stripe billing account yet. Subscribe on
                spooled.cloud to create one, then return here to manage invoices and payment
                methods.
              </p>
              <Button onClick={handleViewPricing} variant="outline">
                <ExternalLink className="mr-2 h-4 w-4" />
                View pricing on spooled.cloud
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pricing CTA — no in-dashboard plan prices or feature matrices */}
      {!isPaidPlan && (
        <Card>
          <CardHeader>
            <CardTitle>Plans & pricing</CardTitle>
            <CardDescription>
              Current plan limits and prices are published on spooled.cloud
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              We do not show plan prices here because billing checkout happens on spooled.cloud.
              Visit the pricing page for up-to-date tiers, limits, and subscription options.
            </p>
            <Button onClick={handleViewPricing} size="lg">
              <ExternalLink className="mr-2 h-4 w-4" />
              View pricing on spooled.cloud
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function BillingPage() {
  return (
    <ProtectedPage>
      <BillingContent />
    </ProtectedPage>
  );
}
