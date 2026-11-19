import { useState } from 'react'
import { CalendarDays, ChevronDown, CircleUserRound, LayoutDashboard, LogOut, Menu, Settings, X, ClipboardList } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const navigation = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/tasks', label: 'Tasks', icon: ClipboardList },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/team', label: 'Team', icon: CircleUserRound, adminOnly: true }
]

const pageTitles = {
  '/dashboard': ['Overview', 'Your team’s work, at a glance.'],
  '/tasks': ['Tasks', 'Plan, assign, and move work forward.'],
  '/calendar': ['Calendar', 'See what’s coming up across the stores.'],
  '/team': ['Team', 'Manage employee access and accounts.']
}

export default function AppShell({ children }) {
  const { profile, session, signOut, demoMode, switchDemoRole } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [signOutError, setSignOutError] = useState('')
  const location = useLocation()
  const [title, subtitle] = pageTitles[location.pathname] || pageTitles['/dashboard']
  const visibleNavigation = navigation.filter(item => !item.adminOnly || profile.role === 'admin')

  async function handleSignOut() {
    try {
      await signOut()
    } catch (error) {
      setSignOutError(error.message)
    }
  }

  return (
    <div className="workspace-shell">
      <aside className={`workspace-sidebar ${menuOpen ? 'workspace-sidebar-open' : ''}`}>
        <div className="sidebar-brand">
          <span className="brand-symbol">N<span>.</span></span>
          <span className="brand-wordmark">NOVA<small>OPERATIONS</small></span>
          <button className="mobile-close" onClick={() => setMenuOpen(false)} aria-label="Close navigation"><X size={18}/></button>
        </div>
        <div className="workspace-picker">
          <span className="workspace-picker-icon"><Settings size={16}/></span>
          <span><strong>Store operations</strong><small>Nova + Tone Garage</small></span>
          <ChevronDown size={14}/>
        </div>
        <span className="nav-caption">WORKSPACE</span>
        <nav className="primary-nav" aria-label="Main navigation">
          {visibleNavigation.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} onClick={() => setMenuOpen(false)} className={({ isActive }) => isActive ? 'nav-item nav-item-active' : 'nav-item'}>
              <Icon size={17}/><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="note-icon"><CircleUserRound size={16}/></span>
            <strong>{demoMode ? 'Demo preview' : 'Work in sync'}</strong>
            <p>{demoMode ? 'Sample tasks are temporary and are not shared.' : 'Tasks are stored in your shared team database.'}</p>
          </div>
          <div className="signed-in-user">
            <span className="user-avatar">{(profile.full_name || session.user.email || 'U').slice(0, 2).toUpperCase()}</span>
            <span className="signed-in-copy"><strong>{profile.full_name || session.user.email}</strong><small>{profile.role === 'admin' ? 'Administrator' : 'Employee'}</small></span>
            <button className="signout-button" onClick={handleSignOut} aria-label="Sign out" title="Sign out"><LogOut size={16}/></button>
          </div>
          {signOutError && <p className="inline-error">{signOutError}</p>}
        </div>
      </aside>
      {menuOpen && <button className="sidebar-scrim" onClick={() => setMenuOpen(false)} aria-label="Close navigation overlay"/>}
      <main className="workspace-main">
        <header className="workspace-topbar">
          <button className="mobile-menu-toggle" onClick={() => setMenuOpen(true)} aria-label="Open navigation"><Menu size={20}/></button>
          <div className="topbar-title"><span>NOVA OPS <i>/</i> {title.toUpperCase()}</span><strong>{subtitle}</strong></div>
          <div className="topbar-right">
            <span className="system-status"><i/>Team workspace</span>
            <span className="topbar-avatar">{(profile.full_name || session.user.email || 'U').slice(0, 2).toUpperCase()}</span>
          </div>
        </header>
        {demoMode && <div className="demo-banner"><span><strong>Demo preview — not authenticated.</strong> Sample task changes are temporary and stay in this browser session.</span><div><button onClick={() => switchDemoRole(profile.role === 'admin' ? 'employee' : 'admin')}>Preview as {profile.role === 'admin' ? 'employee' : 'admin'}</button><button onClick={handleSignOut}>Exit demo</button></div></div>}
        <div className="workspace-content">{children}</div>
        <footer className="workspace-footer"><span>NOVA OPS</span><span>Team workspace <i>·</i> {demoMode ? 'Demo data is temporary' : 'Changes saved to database'}</span></footer>
      </main>
    </div>
  )
}
