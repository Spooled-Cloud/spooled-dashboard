import { RuntimeConfigBootstrap } from '@/components/providers/RuntimeConfigBootstrap';
import { LoginPage } from '@/components/auth/LoginPage';

/**
 * Login shell — loads runtime config before any auth API calls.
 */
export function LoginShell() {
  return (
    <RuntimeConfigBootstrap>
      <LoginPage />
    </RuntimeConfigBootstrap>
  );
}
