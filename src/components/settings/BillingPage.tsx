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

// Plan limits - must match spooled-frontend/src/lib/plans.ts
const PLAN_FEATURES = {
  starter: {
    name: 'Starter',
    description: 'For growing teams and apps',
    features: [
      '10,000 jobs/day',
      '10 queues',
      '5 workers',
      '14 day retention',
      '5 workflows',
    ],
  },
  pro: {
    name: 'Pro',
    description: 'For production workloads',
    features: [
      '100,000 jobs/day',
      '50 queues',
      '25 workers',
      '30 day retention',
      '25 workflows',
    ],
  },
  enterprise: {
    name: 'Enterprise',
    description: 'For scale and compliance',
    features: [
      'Unlimited jobs',
      'Unlimited queues',
      'Unlimited workers',
      '90 day retention',
      '24/7 support + SLA',
    ],
  },
};

function PlanBadge({ planTier }: { planTier: string }) {
  const isPaid = planTier !== 'free';

  return (
    <Badge
      className={
        isPaid
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-muted-foreground bg-muted text-muted-foreground'
      }
    >
      {isPaid && <Sparkles className="mr-1 h-3 w-3" />}
      {getPlanDisplayName(planTier)}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  const info = getSubscriptionStatusInfo(status);

  const colorClasses = {
    default: 'border-muted-foreground bg-muted text-muted-foreground',
    success: 'border-green-500 bg-green-500/10 text-green-700 dark:text-green-400',
    warning: 'border-yellow-500 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
    destructive: 'border-red-500 bg-red-500/10 text-red-700 dark:text-red-400',
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

function BillingContent() {
  const [isRedirecting, setIsRedirecting] = useState(false);

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
      setIsRedirecting(true);
      window.location.href = data.url;
    },
    onError: (error) => {
      toast.error('Failed to open billing portal', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    },
  });

  const handleManageBilling = () => {
    portalMutation.mutate();
  };

  const handleUpgrade = () => {
    // Redirect to the main site's pricing page
    window.open('https://spooled.cloud/pricing', '_blank');
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

  const statusInfo = getSubscriptionStatusInfo(billing?.stripe_subscription_status ?? null);
  const isPaidPlan = billing?.plan_tier && billing.plan_tier !== 'free';
  const hasSubscription = billing?.stripe_subscription_id;

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
                {hasSubscription && <StatusBadge status={billing.stripe_subscription_status} />}
              </div>

              <p className="text-sm text-muted-foreground">{statusInfo.description}</p>

              {billing.stripe_current_period_end && (
                <div className="rounded-lg border bg-muted/50 p-4">
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
                      <div className="mt-2 flex items-center gap-2 rounded-md bg-yellow-500/10 p-2 text-yellow-700 dark:text-yellow-400">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-sm">
                          Your subscription will cancel at the end of this billing period
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!isPaidPlan && (
                <div className="rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <Sparkles className="mt-0.5 h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">Upgrade to unlock more features</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Get higher limits, longer retention, and advanced features.
                        </p>
                      </div>
                    </div>
                    <Button onClick={handleUpgrade} size="sm">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      View Plans
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
            {billing?.has_stripe_customer
              ? 'Update payment methods, view invoices, and manage your subscription'
              : 'Subscribe to a plan to unlock billing management'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-10 w-40" />
          ) : billing?.has_stripe_customer ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Click below to open the Stripe billing portal where you can:
              </p>
              <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                <li>Update your payment method</li>
                <li>View and download invoices</li>
                <li>Change or cancel your subscription</li>
                <li>Update billing information</li>
              </ul>
              <Button
                onClick={handleManageBilling}
                disabled={portalMutation.isPending || isRedirecting}
              >
                {portalMutation.isPending || isRedirecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isRedirecting ? 'Redirecting...' : 'Opening...'}
                  </>
                ) : (
                  <>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open Billing Portal
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                You don't have an active subscription yet. Upgrade your plan to access billing
                management.
              </p>
              <Button onClick={handleUpgrade}>
                <Sparkles className="mr-2 h-4 w-4" />
                Upgrade Plan
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plan Comparison */}
      {!isPaidPlan && (
        <Card>
          <CardHeader>
            <CardTitle>Compare Plans</CardTitle>
            <CardDescription>Find the right plan for your needs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {/* Starter */}
              <div className="rounded-lg border p-4">
                <h3 className="font-semibold">{PLAN_FEATURES.starter.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {PLAN_FEATURES.starter.description}
                </p>
                <ul className="mt-4 space-y-2 text-sm">
                  {PLAN_FEATURES.starter.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Pro */}
              <div className="rounded-lg border-2 border-primary p-4">
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="font-semibold">{PLAN_FEATURES.pro.name}</h3>
                  <Badge className="bg-primary text-primary-foreground">Popular</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{PLAN_FEATURES.pro.description}</p>
                <ul className="mt-4 space-y-2 text-sm">
                  {PLAN_FEATURES.pro.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Enterprise */}
              <div className="rounded-lg border p-4">
                <h3 className="font-semibold">{PLAN_FEATURES.enterprise.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {PLAN_FEATURES.enterprise.description}
                </p>
                <ul className="mt-4 space-y-2 text-sm">
                  {PLAN_FEATURES.enterprise.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="mt-6 flex justify-center">
              <Button onClick={handleUpgrade} size="lg">
                <ExternalLink className="mr-2 h-4 w-4" />
                View Pricing & Upgrade
              </Button>
            </div>
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
