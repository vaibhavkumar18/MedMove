import { createBrowserRouter, Navigate } from 'react-router-dom';

import ProtectedRoute from './ProtectedRoute';

import LoginPage from '../pages/LoginPage';
import SignupPage from '../pages/SignupPage';
import HospitalDashboardPage from '../pages/HospitalDashboardPage';
import NetworkDashboardPage from '../pages/NetworkDashboardPage';
import InventoryPage from '../pages/InventoryPage';
import RecommendationsPage from '../pages/RecommendationsPage';

import AppLayout from '../components/AppLayout';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/signup',
    element: <SignupPage />,
  },

  // Shared routes: accessible to both authenticated roles.
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
        ],
      },
    ],
  },

  // Hospital-only dashboard.
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

  // Network coordinator-only dashboard.
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

  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);