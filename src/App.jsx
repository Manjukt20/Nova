import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell'
import { AuthProvider, useAuth } from './context/AuthContext'
import { TaskProvider } from './context/TaskContext'
import CalendarPage from './pages/Calendar'
import ChangePasswordPage from './pages/ChangePassword'
import Dashboard from './pages/Dashboard'
import LoginPage from './pages/Login'
import TeamPage from './pages/Team'
import TasksPage from './pages/Tasks'

function LoadingScreen() {
  return <main className="loading-screen"><span className="loading-mark">I<span>.</span></span><div className="spinner"/><p>Preparing your workspace…</p></main>
}

function AdminOnly() {
  const { profile } = useAuth()
  return profile?.role === 'admin' ? <Outlet /> : <Navigate to="/dashboard" replace />
}

function ProtectedWorkspace() {
  const { session, profile, loading, profileLoading, profileError, signOut } = useAuth()

  if (loading || (session && profileLoading)) return <LoadingScreen />
  if (!session) return <Navigate to="/login" replace />
  if (!profile || profileError) {
    return (
      <main className="account-state">
        <span className="brand-symbol">I<span>.</span></span>
        <h1>We couldn’t load your team profile.</h1>
        <p>{profileError || 'Ask an administrator to confirm your account has an assigned employee or administrator role.'}</p>
        <button className="button button-dark" onClick={() => signOut()}>Sign out</button>
      </main>
    )
  }
  if (profile.must_change_password) return <ChangePasswordPage />

  return <TaskProvider><AppShell><Outlet /></AppShell></TaskProvider>
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedWorkspace />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/change-password" element={<ChangePasswordPage />} />
            <Route element={<AdminOnly />}>
              <Route path="/team" element={<TeamPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
