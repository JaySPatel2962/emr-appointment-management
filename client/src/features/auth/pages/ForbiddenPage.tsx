import { ShieldX } from 'lucide-react';

import { ButtonLink } from '@/components/ui/ButtonLink';
import { EmptyState } from '@/components/ui/EmptyState';
import { ROLE_LABELS } from '@/constants/roles';
import { ROUTES } from '@/constants/routes';
import { useCurrentUser } from '@/features/auth/hooks/useAuth';
import { usePageTitle } from '@/hooks/usePageTitle';

export const ForbiddenPage = () => {
  const user = useCurrentUser();
  usePageTitle('No access');

  return (
    <EmptyState
      icon={ShieldX}
      headingLevel={1}
      title="You don't have access to this page"
      description={`Your role (${ROLE_LABELS[user.role]}) can't open this page. If you need it, ask a Super Admin.`}
      action={<ButtonLink to={ROUTES.dashboard}>Go to the dashboard</ButtonLink>}
    />
  );
};
