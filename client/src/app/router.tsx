import { Suspense } from 'react';
import { createBrowserRouter } from 'react-router';

import { AppLayout } from '@/app/layout/AppLayout';
import { lazyNamed } from '@/app/lazy';
import { NotFoundPage } from '@/app/pages/NotFoundPage';
import { RouteErrorPage } from '@/app/RouteErrorPage';
import { PageLoader } from '@/components/feedback/PageLoader';
import { ROUTE_ACCESS, ROUTES } from '@/constants/routes';
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';
import { PublicOnlyRoute } from '@/features/auth/components/PublicOnlyRoute';
import { RoleRoute } from '@/features/auth/components/RoleRoute';

// Every page is its own chunk, fetched the first time it is opened.
const LoginPage = lazyNamed(() => import('@/features/auth/pages/LoginPage'), 'LoginPage');
const DashboardPage = lazyNamed(
  () => import('@/features/dashboard/pages/DashboardPage'),
  'DashboardPage',
);
const SchedulerPage = lazyNamed(
  () => import('@/features/scheduler/pages/SchedulerPage'),
  'SchedulerPage',
);
const BookingPage = lazyNamed(() => import('@/features/booking/pages/BookingPage'), 'BookingPage');
const AppointmentListPage = lazyNamed(
  () => import('@/features/appointments/pages/AppointmentListPage'),
  'AppointmentListPage',
);
const AdminPage = lazyNamed(() => import('@/features/admin/pages/AdminPage'), 'AdminPage');

export const router = createBrowserRouter([
  {
    path: ROUTES.login,
    errorElement: <RouteErrorPage />,
    element: (
      <PublicOnlyRoute>
        <Suspense fallback={<PageLoader fullScreen />}>
          <LoginPage />
        </Suspense>
      </PublicOnlyRoute>
    ),
  },
  {
    path: ROUTES.dashboard,
    errorElement: <RouteErrorPage />,
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: ROUTES.scheduler, element: <SchedulerPage /> },
      { path: ROUTES.appointments, element: <AppointmentListPage /> },
      {
        path: ROUTES.booking,
        element: (
          <RoleRoute roles={ROUTE_ACCESS.booking}>
            <BookingPage />
          </RoleRoute>
        ),
      },
      {
        path: ROUTES.admin,
        element: (
          <RoleRoute roles={ROUTE_ACCESS.admin}>
            <AdminPage />
          </RoleRoute>
        ),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
