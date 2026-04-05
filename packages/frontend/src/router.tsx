import React, { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Shell } from '@/components/layout/Shell';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { useAuthStore } from '@/stores/authStore';

// Lazy-loaded pages
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const CasesPage = lazy(() => import('@/pages/CasesPage'));
const CaseDetailPage = lazy(() => import('@/pages/CaseDetailPage'));
const GraphPage = lazy(() => import('@/pages/GraphPage'));
const MapPage = lazy(() => import('@/pages/MapPage'));
const ThreatsPage = lazy(() => import('@/pages/ThreatsPage'));
const CollectionPage = lazy(() => import('@/pages/CollectionPage'));
const SearchPage = lazy(() => import('@/pages/SearchPage'));
const ReportsPage = lazy(() => import('@/pages/ReportsPage'));
const AdminPage = lazy(() => import('@/pages/AdminPage'));
const LoginPage = lazy(() => import('@/pages/LoginPage'));

function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingSpinner size="lg" text="Loading..." className="mt-20" />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <SuspenseWrapper>
        <LoginPage />
      </SuspenseWrapper>
    ),
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <Shell />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: (
          <SuspenseWrapper>
            <DashboardPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'cases',
        element: (
          <SuspenseWrapper>
            <CasesPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'cases/:id',
        element: (
          <SuspenseWrapper>
            <CaseDetailPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'graph',
        element: (
          <SuspenseWrapper>
            <GraphPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'map',
        element: (
          <SuspenseWrapper>
            <MapPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'threats',
        element: (
          <SuspenseWrapper>
            <ThreatsPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'collection',
        element: (
          <SuspenseWrapper>
            <CollectionPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'search',
        element: (
          <SuspenseWrapper>
            <SearchPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'reports',
        element: (
          <SuspenseWrapper>
            <ReportsPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'admin',
        element: (
          <SuspenseWrapper>
            <AdminPage />
          </SuspenseWrapper>
        ),
      },
    ],
  },
]);
