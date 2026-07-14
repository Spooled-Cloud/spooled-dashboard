import { Menu, User, LogOut, Settings, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConnectionStatus } from '@/components/realtime/ConnectionStatus';
import { useAuthStore } from '@/stores/auth';
import { useShellStore } from '@/stores/shell';

export function Header() {
  const { logout, currentOrganization, user } = useAuthStore();
  const { toggleMobileNav } = useShellStore();

  const handleLogout = async () => {
    await logout();
  };

  const orgName = currentOrganization?.name || 'Organization';
  const orgId = user?.organization_id;

  return (
    <header className="safe-area-x flex h-14 shrink-0 items-center gap-3 border-b border-lane-border bg-card px-3 sm:px-4 lg:h-16 lg:px-6">
      {/* Mobile menu */}
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0 lg:hidden"
        onClick={toggleMobileNav}
        aria-label="Open navigation menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Org identity */}
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <div className="bg-muted/50 hidden h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-lane-border sm:flex">
          <Building2 className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium leading-tight">{orgName}</p>
          {orgId && (
            <p className="truncate font-mono text-xs tabular-nums text-muted-foreground">{orgId}</p>
          )}
        </div>
      </div>

      {/* Realtime status slot */}
      <div className="bg-background/80 flex shrink-0 items-center rounded-sm border border-lane-border px-2 py-1.5 sm:px-3">
        <ConnectionStatus />
      </div>

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="shrink-0" aria-label="Account menu">
            <User className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium">{orgName}</p>
              {orgId && (
                <p className="truncate font-mono text-xs tabular-nums text-muted-foreground">
                  {orgId}
                </p>
              )}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <a href="/settings/profile" className="cursor-pointer">
              <User className="mr-2 h-4 w-4" />
              Profile
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href="/settings" className="cursor-pointer">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </a>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
