/**
 * Dashboard Home Container
 *
 * Wraps the dashboard with ProtectedPage (auth + query provider)
 */

import { ProtectedPage } from '@/components/providers/ProtectedPage';
import { DashboardHomeEnhanced } from './DashboardHomeEnhanced';

export function DashboardHome() {
  return (
    <ProtectedPage>
      <DashboardHomeEnhanced />
    </ProtectedPage>
  );
}
