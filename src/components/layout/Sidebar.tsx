import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Briefcase,
  Layers,
  Server,
  GitBranch,
  Clock,
  Key,
  Webhook,
  Building,
  User,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/button';

interface NavItemConfig {
  label: string;
  href: string;
  Icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

const navigationConfig: NavItemConfig[] = [
  { label: 'Dashboard', href: '/dashboard', Icon: LayoutDashboard },
  { label: 'Jobs', href: '/jobs', Icon: Briefcase },
  { label: 'Dead Letter Queue', href: '/jobs/dlq', Icon: AlertTriangle },
  { label: 'Queues', href: '/queues', Icon: Layers },
  { label: 'Workers', href: '/workers', Icon: Server },
  { label: 'Workflows', href: '/workflows', Icon: GitBranch },
  { label: 'Schedules', href: '/schedules', Icon: Clock },
];

const settingsNavigationConfig: NavItemConfig[] = [
  { label: 'API Keys', href: '/settings/api-keys', Icon: Key },
  { label: 'Webhooks', href: '/settings/webhooks', Icon: Webhook },
  { label: 'Organization', href: '/settings/organization', Icon: Building },
  { label: 'Profile', href: '/settings/profile', Icon: User },
];

/**
 * Check if a nav item should be highlighted as active.
 * Uses startsWith for parent routes but exact match for specific routes like /jobs/dlq.
 */
function isNavItemActive(currentPath: string, navHref: string): boolean {
  // Exact match for specific routes
  if (currentPath === navHref) return true;

  // For /jobs, don't match /jobs/dlq as that has its own nav item
  if (navHref === '/jobs' && currentPath.startsWith('/jobs/')) {
    // Check if it's specifically /jobs/dlq which has its own nav item
    return !currentPath.startsWith('/jobs/dlq');
  }

  // For other routes, use startsWith for child routes (e.g., /queues/my-queue)
  if (navHref !== '/dashboard' && currentPath.startsWith(navHref + '/')) {
    return true;
  }

  return false;
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [currentPath, setCurrentPath] = useState('');

  // Read pathname only on client after hydration to avoid SSR mismatch
  useEffect(() => {
    setCurrentPath(window.location.pathname);
  }, []);

  return (
    <aside
      className={cn(
        'relative flex flex-col border-r bg-card transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b px-4">
        {!collapsed && (
          <a href="/dashboard" className="flex items-center gap-3">
            <img src="/logo.webp" alt="Spooled Logo" className="h-10 w-10" />
            <span className="text-lg font-semibold">Spooled</span>
          </a>
        )}
        {collapsed && (
          <a href="/dashboard" className="flex w-full items-center justify-center">
            <img src="/logo.webp" alt="Spooled Logo" className="h-8 w-8" />
          </a>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        <div className="space-y-1">
          {navigationConfig.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center rounded-md text-sm font-medium transition-colors',
                isNavItemActive(currentPath, item.href)
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                collapsed ? 'justify-center p-2' : 'gap-3 px-3 py-2'
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.Icon className={collapsed ? 'h-6 w-6' : 'h-5 w-5'} />
              {!collapsed && <span>{item.label}</span>}
              {!collapsed && item.badge && (
                <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs">
                  {item.badge}
                </span>
              )}
            </a>
          ))}
        </div>

        {/* Settings Section */}
        <div className="mt-6 space-y-1">
          {!collapsed && (
            <div className="px-3 py-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Settings
              </h3>
            </div>
          )}
          {settingsNavigationConfig.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center rounded-md text-sm font-medium transition-colors',
                isNavItemActive(currentPath, item.href)
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                collapsed ? 'justify-center p-2' : 'gap-3 px-3 py-2'
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.Icon className={collapsed ? 'h-6 w-6' : 'h-5 w-5'} />
              {!collapsed && <span>{item.label}</span>}
            </a>
          ))}
        </div>
      </nav>

      {/* Collapse Toggle */}
      <div className="border-t p-4">
        <Button
          variant="ghost"
          size={collapsed ? 'icon' : 'sm'}
          onClick={() => setCollapsed(!collapsed)}
          className="w-full"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="mr-2 h-4 w-4" />
              <span>Collapse</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}
