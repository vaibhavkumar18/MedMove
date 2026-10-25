
import { Navigate, Outlet } from 'react-router-dom';

import { useAppSelector } from '../hooks/useAppSelector';
import type { UserRole } from '../types/contracts';

interface Props {
  roles?: UserRole[];
}

export default function ProtectedRoute({ roles }: Props) {
  const { user, isInitializing } = useAppSelector(
    (state) => state.auth,
  );

  if (isInitializing) {
    return (
      <main
        className="flex min-h-screen items-center justify-center bg-[#f6f8f6] px-5"
        role="status"
        aria-live="polite"
      >
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-[#cdebe1] bg-white px-8 py-7 text-center shadow-sm">
          <span className="relative grid h-12 w-12 place-items-center">
            <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-[#d9f0e8] border-t-[#0d9488]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#0d9488]" />
          </span>

          <div>
            <p className="text-sm font-semibold text-slate-800">
              Checking your session
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Please wait while we verify your access.
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    const destination =
      user.role === 'NETWORK_COORDINATOR'
        ? '/network'
        : '/dashboard';

    return <Navigate to={destination} replace />;
  }

  return <Outlet />;
}
