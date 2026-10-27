
import { useEffect, useRef, useState } from 'react';
import { LayoutDashboard, LogOut, Network } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function PublicNavbar() {
  const { user, isInitializing, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  function handleLogout() {
    setOpen(false);
    logout();
    navigate('/', { replace: true });
  }

  const dashboardPath =
    user?.role === 'NETWORK_COORDINATOR' ? '/network' : '/dashboard';

  const initials = user
    ? user.full_name
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0])
        .join('')
        .toUpperCase() || 'U'
    : '';

  return (
    <header className="sticky top-0 z-40 border-b border-[#ded7c8] bg-[#f3efe6]/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:px-8">

        {/* Brand */}
        <Link
          to="/"
          className="inline-flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f625d]"
          aria-label="MedMove home"
        >
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#1f625d] text-white">
            <Network size={17} strokeWidth={2.4} />
          </span>
          <span className="text-[15px] font-bold tracking-tight text-[#193632]">
            medmove
          </span>
        </Link>

        {/* Right side — depends on auth state */}
        {isInitializing ? (
          // Blank placeholder while session restores — prevents flash of wrong button
          <div className="h-8 w-20 animate-pulse rounded-lg bg-[#ded7c8]" />
        ) : user ? (
          /* ── Logged in: avatar + dropdown ──────────────────────────── */
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              aria-label="Open user menu"
              aria-expanded={open}
              aria-haspopup="true"
              onClick={() => setOpen((o) => !o)}
              className="inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors hover:bg-[#e6eee5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f625d]"
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#1f625d] text-[11px] font-bold text-white">
                {initials}
              </span>
              <span className="hidden max-w-[120px] truncate text-[13px] font-semibold text-[#193632] sm:block">
                {user.full_name}
              </span>
            </button>

            {open && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-48 overflow-hidden rounded-xl border border-[#ded7c8] bg-white shadow-lg"
              >
                {/* User info header */}
                <div className="border-b border-[#ded7c8] px-4 py-3">
                  <p className="truncate text-sm font-semibold text-[#193632]">{user.full_name}</p>
                  <p className="truncate text-[11px] text-[#71827d]">
                    {user.role === 'NETWORK_COORDINATOR' ? 'Network Coordinator' : (user.facility_name ?? user.facility_code ?? 'Hospital User')}
                  </p>
                </div>

                {/* Dashboard */}
                <Link
                  to={dashboardPath}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#193632] transition-colors hover:bg-[#f0f5ef] focus-visible:outline-none focus-visible:bg-[#f0f5ef]"
                >
                  <LayoutDashboard size={15} className="shrink-0 text-[#1f625d]" />
                  Dashboard
                </Link>

                <div className="border-t border-[#ded7c8]" />

                {/* Sign out */}
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-[#9b4234] transition-colors hover:bg-[#fbefea] focus-visible:outline-none focus-visible:bg-[#fbefea]"
                >
                  <LogOut size={15} className="shrink-0" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        ) : (
          /* ── Logged out: Sign in button ─────────────────────────────── */
          <Link
            to="/login"
            className="inline-flex items-center justify-center rounded-lg bg-[#1f625d] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#194f4b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f625d] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f3efe6]"
          >
            Sign in
          </Link>
        )}

      </div>
    </header>
  );
}
