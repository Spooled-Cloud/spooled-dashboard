import { useState, useEffect, useMemo } from 'react';
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
  CreditCard,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useShellStore } from '@/stores/shell';
import { useRuntimeFeatures } from '@/lib/hooks/use-runtime-features';

interface NavItemConfig {
  label: string;
  href: string;
  Icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  featureFlag?: 'workflows' | 'schedules';
}

const SIDEBAR_COLLAPSED_KEY = 'spooled_sidebar_collapsed';

const baseNavigationConfig: NavItemConfig[] = [
  { label: 'Dashboard', href: '/dashboard', Icon: LayoutDashboard },
  { label: 'Jobs', href: '/jobs', Icon: Briefcase },
  { label: 'Dead Letter Queue', href: '/jobs/dlq', Icon: AlertTriangle },
  { label: 'Queues', href: '/queues', Icon: Layers },
  { label: 'Workers', href: '/workers', Icon: Server },
  { label: 'Workflows', href: '/workflows', Icon: GitBranch, featureFlag: 'workflows' },
  { label: 'Schedules', href: '/schedules', Icon: Clock, featureFlag: 'schedules' },
];

const settingsNavigationConfig: NavItemConfig[] = [
  { label: 'API Keys', href: '/settings/api-keys', Icon: Key },
  { label: 'Webhooks', href: '/settings/webhooks', Icon: Webhook },
  { label: 'Organization', href: '/settings/organization', Icon: Building },
  { label: 'Billing', href: '/settings/billing', Icon: CreditCard },
  { label: 'Session', href: '/settings/profile', Icon: User },
];

function isNavItemActive(currentPath: string, navHref: string): boolean {
  if (currentPath === navHref) return true;

  if (navHref === '/jobs' && currentPath.startsWith('/jobs/')) {
    return !currentPath.startsWith('/jobs/dlq');
  }

  if (navHref !== '/dashboard' && currentPath.startsWith(navHref + '/')) {
    return true;
  }

  return false;
}

function loadCollapsedState(): boolean {
  try {
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    return stored === 'true';
  } catch {
    return false;
  }
}

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
  onNavigate?: () => void;
}

function NavLink({ item, isActive, collapsed, onNavigate }: NavLinkProps) {
  const linkContent = (
    <a
      href={item.href}
      onClick={onNavigate}
      className={cn(
        'flex items-center rounded-sm border-l-[3px] text-sm font-medium transition-colors motion-reduce:transition-none',
        'min-h-[44px]',
        isActive
          ? 'spool-rail bg-accent/60 border-l-spool-accent text-accent-foreground'
          : 'hover:bg-muted/80 border-l-transparent text-muted-foreground hover:text-foreground',
        collapsed ? 'justify-center px-2' : 'gap-3 px-3 py-2.5'
      )}
    >
      <item.Icon className="h-5 w-5 flex-shrink-0" />
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge !== undefined && item.badge > 0 && (
            <span className="bg-primary/10 flex h-5 min-w-[20px] items-center justify-center rounded-sm px-1.5 text-xs font-medium tabular-nums">
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

interface SidebarNavProps {
  collapsed: boolean;
  currentPath: string;
  navigation: NavItemConfig[];
  onNavigate?: () => void;
}

function SidebarNav({ collapsed, currentPath, navigation, onNavigate }: SidebarNavProps) {
  return (
    <nav className="scrollbar-thin flex-1 overflow-y-auto p-3">
      <div className="space-y-0.5">
        {navigation.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            isActive={isNavItemActive(currentPath, item.href)}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        ))}
      </div>

      <div className="mt-6 space-y-0.5">
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
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </nav>
  );
}

function SidebarBrand({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="flex h-14 shrink-0 items-center border-b border-lane-border px-4 lg:h-16">
      <a
        href="/dashboard"
        className={cn(
          'flex items-center transition-opacity motion-reduce:transition-none',
          collapsed ? 'w-full justify-center' : 'gap-3'
        )}
      >
        <img
          src="/logo.webp"
          alt="Spooled Logo"
          className={cn(
            'transition-all motion-reduce:transition-none',
            collapsed ? 'h-9 w-9' : 'h-10 w-10'
          )}
        />
        <span
          className={cn(
            'overflow-hidden whitespace-nowrap text-lg font-semibold tracking-tight transition-all motion-reduce:transition-none',
            collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
          )}
        >
          Spooled
        </span>
      </a>
    </div>
  );
}

function SidebarCollapseToggle({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="hidden shrink-0 border-t border-lane-border p-3 lg:block">
      {collapsed ? (
        <Tooltip delayDuration={100}>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={onToggle} className="h-10 w-full">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            Expand sidebar
          </TooltipContent>
        </Tooltip>
      ) : (
        <Button variant="ghost" size="sm" onClick={onToggle} className="h-10 w-full justify-start">
          <ChevronLeft className="mr-2 h-4 w-4" />
          <span>Collapse</span>
        </Button>
      )}
    </div>
  );
}

function useFilteredNavigation(features: { enableWorkflows: boolean; enableSchedules: boolean }) {
  return useMemo(
    () =>
      baseNavigationConfig.filter((item) => {
        if (item.featureFlag === 'workflows') return features.enableWorkflows;
        if (item.featureFlag === 'schedules') return features.enableSchedules;
        return true;
      }),
    [features.enableWorkflows, features.enableSchedules]
  );
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [currentPath, setCurrentPath] = useState('');
  const [mounted, setMounted] = useState(false);
  const { mobileNavOpen, setMobileNavOpen } = useShellStore();
  const features = useRuntimeFeatures();
  const navigation = useFilteredNavigation(features);

  useEffect(() => {
    setMounted(true);
    setCurrentPath(window.location.pathname);
    setCollapsed(loadCollapsedState());
  }, []);

  const handleToggleCollapse = () => {
    const newState = !collapsed;
    setCollapsed(newState);
    saveCollapsedState(newState);
  };

  const closeMobileNav = () => setMobileNavOpen(false);

  if (!mounted) {
    return (
      <>
        <aside className="relative hidden w-64 shrink-0 flex-col border-r border-lane-border bg-card lg:flex">
          <div className="flex h-16 items-center border-b px-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-sm bg-muted" />
              <div className="h-5 w-20 rounded-sm bg-muted" />
            </div>
          </div>
        </aside>
        <div className="flex h-14 shrink-0 items-center border-b bg-card px-4 lg:hidden">
          <div className="h-8 w-8 rounded-sm bg-muted" />
        </div>
      </>
    );
  }

  return (
    <TooltipProvider>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'relative hidden shrink-0 flex-col border-r border-lane-border bg-card transition-[width] duration-300 ease-in-out motion-reduce:transition-none lg:flex',
          collapsed ? 'w-[68px]' : 'w-64'
        )}
      >
        <SidebarBrand collapsed={collapsed} />
        <SidebarNav collapsed={collapsed} currentPath={currentPath} navigation={navigation} />
        <SidebarCollapseToggle collapsed={collapsed} onToggle={handleToggleCollapse} />
      </aside>

      {/* Mobile drawer */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="flex w-[min(18rem,88vw)] flex-col p-0">
          <SheetTitle className="sr-only">Navigation menu</SheetTitle>
          <SidebarBrand collapsed={false} />
          <SidebarNav
            collapsed={false}
            currentPath={currentPath}
            navigation={navigation}
            onNavigate={closeMobileNav}
          />
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  );
}
