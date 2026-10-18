import { Suspense, useRef } from 'react';
import { Outlet, ScrollRestoration, useLocation } from 'react-router';

import { MobileNav } from '@/app/layout/MobileNav';
import { SideNav } from '@/app/layout/SideNav';
import { SkipLink } from '@/app/layout/SkipLink';
import { ErrorBoundary } from '@/components/feedback/ErrorBoundary';
import { ErrorFallback } from '@/components/feedback/ErrorFallback';
import { PageLoader } from '@/components/feedback/PageLoader';
import { useFocusOnChange } from '@/hooks/useFocusOnChange';

const MAIN_ID = 'main-content';

/** The signed-in app: navigation on the side (or in a drawer on small screens) and the page. */
export const AppLayout = () => {
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  useFocusOnChange(mainRef, pathname);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)]">
      <SkipLink targetId={MAIN_ID} />
      <aside className="sticky top-0 hidden h-dvh border-r border-line bg-paper lg:block">
        <SideNav />
      </aside>
      <div className="flex min-w-0 flex-col">
        <MobileNav />
        <main
          ref={mainRef}
          id={MAIN_ID}
          tabIndex={-1}
          className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-8"
        >
          {/* A page that crashes shows an error here while the navigation keeps working. */}
          <ErrorBoundary resetKey={pathname} fallback={(props) => <ErrorFallback {...props} />}>
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
      <ScrollRestoration />
    </div>
  );
};
