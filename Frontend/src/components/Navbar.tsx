import { Activity, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return <header className="topbar">
    <div className="brand-lockup"><span className="brand-mark"><Activity size={19} /></span><span><strong>medmove</strong><small>{user?.facility_name ?? 'HEALTH NETWORK'}</small></span></div>
    <button className="button button-secondary" onClick={() => { logout(); navigate('/login', { replace: true }); }}><LogOut size={15} /> Sign out</button>
  </header>;
}
