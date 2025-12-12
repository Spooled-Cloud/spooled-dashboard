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

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
}

const navigation: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
  { label: 'Jobs', href: '/jobs', icon: <Briefcase className="h-5 w-5" /> },
  { label: 'Dead Letter Queue', href: '/jobs/dlq', icon: <AlertTriangle className="h-5 w-5" /> },
  { label: 'Queues', href: '/queues', icon: <Layers className="h-5 w-5" /> },
  { label: 'Workers', href: '/workers', icon: <Server className="h-5 w-5" /> },
  { label: 'Workflows', href: '/workflows', icon: <GitBranch className="h-5 w-5" /> },
  { label: 'Schedules', href: '/schedules', icon: <Clock className="h-5 w-5" /> },
];

const settingsNavigation: NavItem[] = [
  { label: 'API Keys', href: '/settings/api-keys', icon: <Key className="h-5 w-5" /> },
  { label: 'Webhooks', href: '/settings/webhooks', icon: <Webhook className="h-5 w-5" /> },
  { label: 'Organization', href: '/settings/organization', icon: <Building className="h-5 w-5" /> },
  { label: 'Profile', href: '/settings/profile', icon: <User className="h-5 w-5" /> },
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
          {navigation.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isNavItemActive(currentPath, item.href)
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                collapsed && 'justify-center'
              )}
              title={collapsed ? item.label : undefined}
            >
              {item.icon}
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
          {settingsNavigation.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isNavItemActive(currentPath, item.href)
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                collapsed && 'justify-center'
              )}
              title={collapsed ? item.label : undefined}
            >
              {item.icon}
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
