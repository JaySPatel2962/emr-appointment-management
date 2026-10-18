import { LogOut } from 'lucide-react';
import { NavLink } from 'react-router';

import { navItemsFor } from '@/app/navigation';
import { BrandMark } from '@/components/layout/BrandMark';
import { Button } from '@/components/ui/Button';
import { ROLE_LABELS } from '@/constants/roles';
import { useCurrentUser } from '@/features/auth/hooks/useAuth';
import { useLogout } from '@/features/auth/hooks/useLogout';
import { cn } from '@/utils/cn';

export interface SideNavProps {
  /** Called after a link is followed, so the mobile menu can close. */
  onNavigate?: (() => void) | undefined;
  /** Hidden when the surrounding menu already shows the brand. */
  showBrand?: boolean | undefined;
}

export const SideNav = ({ onNavigate, showBrand = true }: SideNavProps) => {
  const user = useCurrentUser();
  const { logout, loggingOut } = useLogout();

  return (
    <div className="flex h-full flex-col">
      {showBrand ? (
        <div className="px-5 pt-6 pb-4">
          <BrandMark />
        </div>
      ) : null}
      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-2">
        <ul className="flex flex-col gap-1">
          {navItemsFor(user.role).map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors',
                    isActive
                      ? 'bg-carbon-soft text-carbon'
                      : 'text-ink-muted hover:bg-ink/5 hover:text-ink',
                  )
                }
              >
                <Icon aria-hidden="true" size={18} className="shrink-0" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="border-t border-line p-4">
        <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
        <p className="text-xs text-ink-muted">{ROLE_LABELS[user.role]}</p>
        <Button
          variant="secondary"
          size="sm"
          fullWidth
          className="mt-3"
          loading={loggingOut}
          onClick={logout}
        >
          <LogOut aria-hidden="true" size={16} />
          Log out
        </Button>
      </div>
    </div>
  );
};
