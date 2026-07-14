import { useRuntimeFeatures } from '@/lib/hooks/use-runtime-features';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type FeatureFlag = 'workflows' | 'schedules';

interface FeatureGateProps {
  feature: FeatureFlag;
  children: React.ReactNode;
}

/**
 * Hide feature pages when the matching runtime flag is off.
 * Nav already filters these routes; this covers direct URL access.
 */
export function FeatureGate({ feature, children }: FeatureGateProps) {
  const features = useRuntimeFeatures();
  const enabled = feature === 'workflows' ? features.enableWorkflows : features.enableSchedules;

  if (!enabled) {
    const label = feature === 'workflows' ? 'Workflows' : 'Schedules';
    return (
      <Card>
        <CardHeader>
          <CardTitle>{label} disabled</CardTitle>
          <CardDescription>
            This feature is turned off for this deployment. Contact your operator if you need it
            enabled.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <a href="/dashboard">Back to dashboard</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}
