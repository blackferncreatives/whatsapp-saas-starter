import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          Whats<span>App</span> Campaigns
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/" end className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
            Dashboard
          </NavLink>
          <NavLink to="/contacts" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
            Contacts
          </NavLink>
          <NavLink to="/campaigns" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
            Campaigns
          </NavLink>
        </nav>
        <div className="sidebar-footer">
          {user?.email}
          <br />
          <button onClick={handleLogout}>Log out</button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
