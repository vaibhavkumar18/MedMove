import { createBrowserRouter } from 'react-router-dom';

import ProtectedRoute from './ProtectedRoute';

import LoginPage from '../pages/LoginPage';
import HomePage from '../pages/HomePage';
import HospitalDashboardPage from '../pages/HospitalDashboardPage';
import NetworkDashboardPage from '../pages/NetworkDashboardPage';
import InventoryPage from '../pages/InventoryPage';
import RecommendationsPage from '../pages/RecommendationsPage';
import TransferDetailPage from '../pages/TransferDetailPage';

import AppLayout from '../components/AppLayout';
import PublicLayout from '../components/PublicLayout';

export const router = createBrowserRouter([
  // ── Public routes (no authentication required) ──────────────────────────
  {
    element: <PublicLayout />,
    children: [
      {
        path: '/',
        element: <HomePage />,
      },
      {
        path: '/login',
        element: <LoginPage />,
      },
    ],
  },

  // ── Authenticated: shared routes (both roles) ────────────────────────────
  {
    element: (
      <ProtectedRoute
        roles={['HOSPITAL_USER', 'NETWORK_COORDINATOR']}
      />
    ),
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            path: '/inventory',
            element: <InventoryPage />,
          },
          {
            path: '/recommendations',
            element: <RecommendationsPage />,
          },
          {
            path: '/recommendations/:runId/:transferIndex',
            element: <TransferDetailPage />,
          },
        ],
      },
    ],
  },

  // ── Authenticated: hospital-only dashboard ───────────────────────────────
  {
    element: <ProtectedRoute roles={['HOSPITAL_USER']} />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            path: '/dashboard',
            element: <HospitalDashboardPage />,
          },
        ],
      },
    ],
  },

  // ── Authenticated: coordinator-only dashboard ────────────────────────────
  {
    element: <ProtectedRoute roles={['NETWORK_COORDINATOR']} />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            path: '/network',
            element: <NetworkDashboardPage />,
          },
        ],
      },
    ],
  },

  // Unknown paths fall through to the homepage.
  {
    path: '*',
    element: <HomePage />,
  },
]);
