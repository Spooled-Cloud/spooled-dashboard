import { RuntimeConfigBootstrap } from '@/components/providers/RuntimeConfigBootstrap';
import { OnboardingPage } from '@/components/auth/OnboardingPage';

export function OnboardingShell() {
  return (
    <RuntimeConfigBootstrap>
      <OnboardingPage />
    </RuntimeConfigBootstrap>
  );
}
