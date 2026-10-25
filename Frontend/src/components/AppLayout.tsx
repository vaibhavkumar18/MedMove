import {
  Activity,
  Boxes,
  Building2,
  ChevronDown,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import {
  NavLink,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);

  const isCoordinator = user?.role === 'NETWORK_COORDINATOR';

  useEffect(() => {
    setProfileOpen(false);
  }, [location.pathname]);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const links = isCoordinator
    ? [
        {
          to: '/network',
          label: 'Network overview',
          icon: LayoutDashboard,
        },
        {
          to: '/recommendations',
          label: 'Recommendations',
          icon: ClipboardList,
        },
        {
          to: '/inventory',
          label: 'Inventory',
          icon: Boxes,
        },
      ]
    : [
        {
          to: '/dashboard',
          label: 'My dashboard',
          icon: LayoutDashboard,
        },
        {
          to: '/inventory',
          label: 'Inventory',
          icon: Boxes,
        },
        {
          to: '/recommendations',
          label: 'Recommendations',
          icon: ClipboardList,
        },
      ];

  const currentPage =
    links.find((item) => item.to === location.pathname)?.label ??
    'Dashboard';

  const facilityName = isCoordinator
    ? 'All facilities'
    : user.facility_name ?? user.facility_code ?? 'My facility';

  const initials =
    user.full_name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || 'U';

  function handleLogout() {
    setProfileOpen(false);
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="app-shell app-shell-topnav">
      <header className="app-header">
        <div className="header-main">
          <NavLink
            to={isCoordinator ? '/network' : '/dashboard'}
            className="brand-lockup"
            aria-label="MedMove home"
          >
            <span className="brand-mark">
              <Activity size={21} strokeWidth={2.5} />
            </span>

            <span className="brand-copy">
              <strong>medmove</strong>
              <small>HEALTH NETWORK</small>
            </span>
          </NavLink>

          <div className="header-divider" />

          <div className="workspace-heading">
            <span className="workspace-label">WORKSPACE</span>
            <h1>{currentPage}</h1>
          </div>

          <div className="header-spacer" />

          <div className="environment-indicator">
            <span className="live-dot" />
            <span>Demo environment</span>
          </div>

          <div className="header-divider header-meta-divider" />

          <div className="header-facility">
            <Building2 size={16} />
            <span title={facilityName}>{facilityName}</span>
          </div>

          <div className="profile-menu">
            <button
              type="button"
              className={`profile-trigger${profileOpen ? ' is-open' : ''}`}
              aria-label="Open account menu"
              aria-expanded={profileOpen}
              onClick={() => setProfileOpen((open) => !open)}
            >
              <span className="avatar">{initials}</span>

              <span className="profile-trigger-copy">
                <strong>{user.full_name}</strong>
                <small>
                  {isCoordinator
                    ? 'Network Coordinator'
                    : user.facility_code ?? 'Hospital User'}
                </small>
              </span>

              <ChevronDown
                size={15}
                className={`profile-chevron${profileOpen ? ' rotated' : ''}`}
              />
            </button>

            {profileOpen && (
              <>
                <button
                  type="button"
                  className="profile-dismiss"
                  aria-label="Close account menu"
                  onClick={() => setProfileOpen(false)}
                />

                <div className="profile-dropdown">
                  <div className="profile-dropdown-heading">
                    <span className="avatar">{initials}</span>
                    <div>
                      <strong>{user.full_name}</strong>
                      <small>
                        {isCoordinator
                          ? 'Network Coordinator'
                          : 'Hospital User'}
                      </small>
                    </div>
                  </div>

                  <div className="profile-dropdown-facility">
                    <Building2 size={15} />
                    <span>{facilityName}</span>
                  </div>

                  <div className="profile-dropdown-security">
                    <ShieldCheck size={15} />
                    <span>Demo workspace</span>
                  </div>

                  <button
                    type="button"
                    className="logout-button"
                    onClick={handleLogout}
                  >
                    <LogOut size={16} />
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <nav className="primary-nav" aria-label="Main navigation">
          <div className="primary-nav-inner">
            {links.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end
                className={({ isActive }) =>
                  `primary-nav-link${isActive ? ' active' : ''}`
                }
              >
                <Icon size={17} strokeWidth={1.9} />
                <span>{label}</span>
              </NavLink>
            ))}

            <div className="nav-context">
              <span className="nav-context-dot" />
              {isCoordinator ? 'Network access' : 'Facility workspace'}
            </div>
          </div>
        </nav>
      </header>

      <main className="main-area">
        <div className="page-content">
          <Outlet />
        </div>

        <footer className="app-footer">
          <span>
            <ShieldCheck size={14} />
            MedMove · Medicine redistribution decision support
          </span>
          <span>
            Demo data · Recommendations require human review
          </span>
        </footer>
      </main>
    </div>
  );
}
