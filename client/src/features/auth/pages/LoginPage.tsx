import { BrandMark } from '@/components/layout/BrandMark';
import { Alert } from '@/components/ui/Alert';
import { DaySheetPreview } from '@/features/auth/components/DaySheetPreview';
import { LoginForm } from '@/features/auth/components/LoginForm';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { usePageTitle } from '@/hooks/usePageTitle';

export const LoginPage = () => {
  usePageTitle('Log in');
  const { endReason } = useAuth();

  return (
    <div className="grid min-h-dvh bg-canvas lg:grid-cols-[minmax(0,1fr)_minmax(28rem,34rem)]">
      <DaySheetPreview />
      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <BrandMark />
          <h1 className="mt-10 text-2xl font-bold tracking-tight">Log in</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Use the email and password your clinic's Super Admin set up for you.
          </p>
          {endReason === 'expired' ? (
            <Alert tone="info" className="mt-6">
              Your session expired. Log in again to carry on where you left off.
            </Alert>
          ) : null}
          <div className="mt-6">
            <LoginForm />
          </div>
        </div>
      </main>
    </div>
  );
};
