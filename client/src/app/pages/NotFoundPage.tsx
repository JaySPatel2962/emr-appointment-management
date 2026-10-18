import { MapPinOff } from 'lucide-react';
import { useLocation } from 'react-router';

import { ButtonLink } from '@/components/ui/ButtonLink';
import { EmptyState } from '@/components/ui/EmptyState';
import { ROUTES } from '@/constants/routes';
import { usePageTitle } from '@/hooks/usePageTitle';

export const NotFoundPage = () => {
  const { pathname } = useLocation();
  usePageTitle('Page not found');

  return (
    <EmptyState
      icon={MapPinOff}
      headingLevel={1}
      title="Page not found"
      description={
        <>
          There's no page at <span className="font-semibold break-all text-ink">{pathname}</span>.
          Check the address, or go back to the dashboard.
        </>
      }
      action={<ButtonLink to={ROUTES.dashboard}>Go to the dashboard</ButtonLink>}
    />
  );
};
