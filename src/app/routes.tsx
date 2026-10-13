import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate, useLocation } from 'react-router';
import { Layout } from './components/Layout';
import { PageSkeleton } from './components/PageSkeleton';
import { RouteError } from './components/ErrorBoundary';
import { useSession } from './lib/session';
import { pages } from './pageLoaders';

// Route-level code splitting: each page (and heavy deps like recharts) loads on demand.
const page = (loader: () => Promise<Record<string, any>>, name: string) =>
  lazy(() => loader().then((m) => ({ default: m[name] })));

const Dashboard = page(pages.Dashboard, 'Dashboard');
const ApproveLeads = page(pages.ApproveLeads, 'ApproveLeads');
const ApprovedLeads = page(pages.ApprovedLeads, 'ApprovedLeads');
const Conversations = page(pages.Conversations, 'Conversations');
const Meetings = page(pages.Meetings, 'Meetings');
const Analytics = page(pages.Analytics, 'Analytics');
const ContentEngine = page(pages.ContentEngine, 'ContentEngine');
const Profile = page(pages.Profile, 'Profile');
const NotFound = page(() => import('./pages/NotFound'), 'NotFound');
const LoginPage = page(() => import('./pages/LoginPage'), 'default');
const RegisterPage = page(() => import('./pages/RegisterPage'), 'default');

function AuthGuard({ children }: { children: ReactNode }) {
  const token = useSession((s) => s.token);
  const location = useLocation();
  if (!token) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

function GuestOnly({ children }: { children: ReactNode }) {
  const token = useSession((s) => s.token);
  return token ? <Navigate to="/" replace /> : <Suspense fallback={null}>{children}</Suspense>;
}

const s = (node: ReactNode) => <Suspense fallback={<PageSkeleton />}>{node}</Suspense>;

export const router = createBrowserRouter([
  { path: '/login', element: <GuestOnly><LoginPage /></GuestOnly>, errorElement: <RouteError /> },
  { path: '/register', element: <GuestOnly><RegisterPage /></GuestOnly>, errorElement: <RouteError /> },
  {
    path: '/',
    element: (
      <AuthGuard>
        <Layout />
      </AuthGuard>
    ),
    errorElement: <RouteError />,
    children: [
      {
        // Pathless wrapper: page errors render inside the layout instead of replacing it.
        errorElement: <RouteError />,
        children: [
      { index: true, element: s(<Dashboard />) },
      { path: 'approve', element: s(<ApproveLeads />) },
      { path: 'approved', element: s(<ApprovedLeads />) },
      { path: 'conversations', element: s(<Conversations />) },
      { path: 'conversations/:slug', element: s(<Conversations />) },
      { path: 'meetings', element: s(<Meetings />) },
      { path: 'analytics', element: s(<Analytics />) },
      { path: 'content', element: s(<ContentEngine />) },
      { path: 'profile', element: s(<Profile />) },
      { path: '*', element: s(<NotFound />) },
        ],
      },
    ],
  },
]);
