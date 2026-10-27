
import {
  Activity,
  Boxes,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Home,
  LayoutDashboard,
  LogOut,
  Network,
  ShieldCheck,
  Building2,
} from 'lucide-react';
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  useNavigate,
} from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  end?: boolean;
}

interface NavGroup {
  heading?: string;
  items: NavItem[];
}

function SideLink({
  to,
  label,
  icon: Icon,
  end = false,
  collapsed,
}: NavItem & { collapsed: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        [
          'flex items-center rounded-lg py-2.5 text-sm font-medium transition-colors duration-150',
          collapsed ? 'justify-center px-0' : 'gap-3 px-3',
          isActive
            ? collapsed
              ? 'bg-[#e6eee5] text-[#1f625d]'
              : 'border-l-[3px] border-[#1f625d] bg-[#e6eee5] pl-[9px] text-[#1f625d]'
            : collapsed
              ? 'text-[#4a5e59] hover:bg-[#e0e9df] hover:text-[#193632]'
              : 'border-l-[3px] border-transparent text-[#4a5e59] hover:bg-[#e0e9df] hover:text-[#193632]',
        ].join(' ')
      }
    >
      <Icon size={18} strokeWidth={1.8} className="shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  );
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  if (!user) return <Navigate to="/login" replace />;

  const isCoordinator = user?.role === 'NETWORK_COORDINATOR';
  const facilityName = isCoordinator
    ? 'All facilities'
    : (user.facility_name ?? user.facility_code ?? 'My facility');

  const initials =
    user.full_name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || 'U';

  function handleLogout() {
    setProfileOpen(false);
    logout();
    navigate('/login', { replace: true });
  }

  const mainItems: NavItem[] = isCoordinator
    ? [
        { to: '/network',         label: 'Overview',        icon: LayoutDashboard, end: true },
        { to: '/inventory',       label: 'Inventory',       icon: Boxes,           end: true },
        { to: '/recommendations', label: 'Recommendations', icon: ClipboardList,   end: true },
      ]
    : [
        { to: '/dashboard',       label: 'My Dashboard',    icon: LayoutDashboard, end: true },
        { to: '/inventory',       label: 'Inventory',       icon: Boxes,           end: true },
        { to: '/recommendations', label: 'Recommendations', icon: ClipboardList,   end: true },
      ];

  const groups: NavGroup[] = [
    {
      items: [
        { to: '/', label: 'Home', icon: Home, end: true },
      ],
    },
    { heading: 'MAIN', items: mainItems },
    ...(isCoordinator
      ? [{ heading: 'NETWORK', items: [{ to: '/network', label: 'Network view', icon: Network, end: true }] }]
      : []),
  ];

  // Sidebar pixel width — must match the Tailwind class below
  const sidebarPx = collapsed ? 60 : 256;

  return (
    // overflow-visible on the wrapper so the toggle button can bleed past the sidebar edge
    <div className="flex h-screen bg-[#f3efe6] font-sans text-[#193632]">

      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside
        style={{ width: sidebarPx }}
        className="relative flex shrink-0 flex-col overflow-hidden border-r border-[#ded7c8] bg-[#edf2eb] transition-[width] duration-200"
      >
        {/* Brand */}
        <div className="flex h-14 shrink-0 items-center border-b border-[#ded7c8] px-3">
          <Link
            to={isCoordinator ? '/network' : '/dashboard'}
            className="inline-flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f625d]"
            aria-label="MedMove workspace"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#1f625d] text-white">
              <Activity size={17} strokeWidth={2.5} />
            </span>
            {!collapsed && (
              <span className="truncate text-[15px] font-bold tracking-tight text-[#193632]">
                medmove
              </span>
            )}
          </Link>
        </div>

        {/* Nav */}
        <nav
          className={`flex-1 overflow-y-auto overflow-x-hidden py-4 ${collapsed ? 'px-1' : 'px-3'}`}
          aria-label="Sidebar navigation"
        >
          {groups.map((group, gi) => (
            <div key={gi} className={gi > 0 ? 'mt-5' : ''}>
              {group.heading && !collapsed && (
                <p className="mb-2 px-3 text-[10px] font-bold tracking-widest text-[#7a8982]">
                  {group.heading}
                </p>
              )}
              {group.heading && collapsed && (
                <div className="my-2 border-t border-[#ded7c8]" />
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.to}>
                    <SideLink {...item} collapsed={collapsed} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Profile */}
        <div className="shrink-0 border-t border-[#ded7c8] p-2">
          <div className="relative">
            <button
              type="button"
              aria-label="Account menu"
              aria-expanded={profileOpen}
              onClick={() => setProfileOpen((o) => !o)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-[#e0e9df] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f625d] ${collapsed ? 'justify-center' : ''}`}
              title={collapsed ? user.full_name : undefined}
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#1f625d] text-xs font-bold text-white">
                {initials}
              </span>
              {!collapsed && (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-[#193632]">{user.full_name}</p>
                    <p className="truncate text-[11px] text-[#71827d]">{facilityName}</p>
                  </div>
                  <ChevronDown
                    size={14}
                    className={`shrink-0 text-[#71827d] transition-transform ${profileOpen ? 'rotate-180' : ''}`}
                  />
                </>
              )}
            </button>

            {profileOpen && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-40 cursor-default"
                  aria-label="Close account menu"
                  onClick={() => setProfileOpen(false)}
                />
                {/* When collapsed the sidebar is 60px wide — use fixed so the
                    panel isn't clipped; when expanded, absolute works fine.  */}
                <div
                  className={[
                    'z-50 w-56 overflow-hidden rounded-xl border border-[#ded7c8] bg-white shadow-lg',
                    collapsed
                      ? 'fixed bottom-14 left-2'
                      : 'absolute bottom-full left-0 mb-2',
                  ].join(' ')}
                >
                  <div className="flex items-center gap-3 px-4 py-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#1f625d] text-sm font-bold text-white">
                      {initials}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#193632]">{user.full_name}</p>
                      <p className="truncate text-[11px] text-[#71827d]">
                        {isCoordinator ? 'Network Coordinator' : 'Hospital User'}
                      </p>
                    </div>
                  </div>
                  <div className="border-t border-[#ded7c8]" />
                  <div className="flex items-center gap-2 px-4 py-2.5 text-xs text-[#71827d]">
                    <Building2 size={13} /><span className="truncate">{facilityName}</span>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 text-xs text-[#71827d]">
                    <ShieldCheck size={13} /><span>Secure workspace</span>
                  </div>
                  <div className="border-t border-[#ded7c8]" />
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium text-[#9b4234] transition-colors hover:bg-[#fbefea]"
                  >
                    <LogOut size={15} />Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* ── Toggle button — fixed, rides the sidebar right border ─── */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        style={{ left: sidebarPx, top: 140 }}
        className="fixed z-50 -translate-x-1/2 flex h-7 w-7 items-center justify-center rounded-full border border-[#ced9d3] bg-white text-[#7a8982] shadow-md transition-[left] duration-200 hover:border-[#1f625d] hover:bg-[#1f625d] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f625d]"
      >
        {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
      </button>

      {/* ── Main content ─────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

    </div>
  );
}
