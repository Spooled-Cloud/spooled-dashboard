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
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface NavItemConfig {
  label: string;
  href: string;
  Icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

const SIDEBAR_COLLAPSED_KEY = 'spooled_sidebar_collapsed';

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

/**
 * Load collapsed state from localStorage
 */
function loadCollapsedState(): boolean {
  try {
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    return stored === 'true';
  } catch {
    return false;
  }
}

/**
 * Save collapsed state to localStorage
 */
function saveCollapsedState(collapsed: boolean): void {
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
  } catch {
    // Storage might be disabled
  }
}

interface NavLinkProps {
  item: NavItemConfig;
  isActive: boolean;
  collapsed: boolean;
}

function NavLink({ item, isActive, collapsed }: NavLinkProps) {
  const linkContent = (
    <a
      href={item.href}
      className={cn(
        'flex items-center rounded-md text-sm font-medium transition-all duration-200',
        // Better click targets
        'min-h-[44px]',
        isActive
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        collapsed ? 'justify-center px-2' : 'gap-3 px-3 py-2.5'
      )}
    >
      <item.Icon
        className={cn('flex-shrink-0 transition-transform', collapsed ? 'h-5 w-5' : 'h-5 w-5')}
      />
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge !== undefined && item.badge > 0 && (
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary/10 px-1.5 text-xs font-medium">
              {item.badge}
            </span>
          )}
        </>
      )}
    </a>
  );

  if (collapsed) {
    return (
      <Tooltip delayDuration={100}>
        <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          <span>{item.label}</span>
          {item.badge !== undefined && item.badge > 0 && (
            <span className="ml-2 text-muted-foreground">({item.badge})</span>
          )}
        </TooltipContent>
      </Tooltip>
    );
  }

  return linkContent;
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [currentPath, setCurrentPath] = useState('');
  const [mounted, setMounted] = useState(false);

  // Load state on mount
  useEffect(() => {
    setMounted(true);
    setCurrentPath(window.location.pathname);
    setCollapsed(loadCollapsedState());
  }, []);

  // Save collapsed state when it changes
  const handleToggleCollapse = () => {
    const newState = !collapsed;
    setCollapsed(newState);
    saveCollapsedState(newState);
  };

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <aside className="relative flex w-64 flex-col border-r bg-card">
        <div className="flex h-16 items-center border-b px-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded bg-muted" />
            <div className="h-5 w-20 rounded bg-muted" />
          </div>
        </div>
      </aside>
    );
  }

  return (
    <TooltipProvider>
      <aside
        className={cn(
          'relative flex flex-col border-r bg-card transition-all duration-300 ease-in-out',
          collapsed ? 'w-[68px]' : 'w-64'
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center border-b px-4">
          <a
            href="/dashboard"
            className={cn(
              'flex items-center transition-all duration-300',
              collapsed ? 'w-full justify-center' : 'gap-3'
            )}
          >
            <img
              src="/logo.webp"
              alt="Spooled Logo"
              className={cn('transition-all duration-300', collapsed ? 'h-9 w-9' : 'h-10 w-10')}
            />
            <span
              className={cn(
                'overflow-hidden whitespace-nowrap text-lg font-semibold transition-all duration-300',
                collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
              )}
            >
              Spooled
            </span>
          </a>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3">
          {/* Main Navigation */}
          <div className="space-y-1">
            {navigationConfig.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                isActive={isNavItemActive(currentPath, item.href)}
                collapsed={collapsed}
              />
            ))}
          </div>

          {/* Settings Section */}
          <div className="mt-6 space-y-1">
            {collapsed ? (
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <div className="flex justify-center py-2">
                    <Settings className="h-4 w-4 text-muted-foreground" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  Settings
                </TooltipContent>
              </Tooltip>
            ) : (
              <div className="px-3 py-2">
                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Settings className="h-3.5 w-3.5" />
                  Settings
                </h3>
              </div>
            )}
            {settingsNavigationConfig.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                isActive={isNavItemActive(currentPath, item.href)}
                collapsed={collapsed}
              />
            ))}
          </div>
        </nav>

        {/* Collapse Toggle */}
        <div className="border-t p-3">
          {collapsed ? (
            <Tooltip delayDuration={100}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleToggleCollapse}
                  className="h-10 w-full"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                Expand sidebar
              </TooltipContent>
            </Tooltip>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggleCollapse}
              className="h-10 w-full justify-start"
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              <span>Collapse</span>
            </Button>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
