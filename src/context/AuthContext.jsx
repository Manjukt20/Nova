import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [demoMode, setDemoMode] = useState(false)
  const [demoRole, setDemoRole] = useState('admin')
  const [needsSetup, setNeedsSetup] = useState(false)
  const [setupKeyConfigured, setSetupKeyConfigured] = useState(false)
  const [setupKeyRequired, setSetupKeyRequired] = useState(false)
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([apiRequest('/auth/me'), apiRequest('/auth/setup-status')])
      .then(([authResult, setupResult]) => {
        if (!active) return
        setUser(authResult.user)
        setNeedsSetup(setupResult.setup_required)
        setSetupKeyConfigured(setupResult.setup_key_configured)
        setSetupKeyRequired(setupResult.setup_key_required)
        setApiError('')
      })
      .catch(error => {
        if (active) setApiError(error.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [])

  async function login(email, password) {
    const result = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email, password }
    })
    setUser(result.user)
    setApiError('')
    return result.user
  }

  async function registerEmployee(fullName, email, password) {
    return apiRequest('/auth/register', {
      method: 'POST',
      body: { full_name: fullName, email, password }
    })
  }

  async function setupAdmin(values) {
    const result = await apiRequest('/auth/setup', {
      method: 'POST',
      body: {
        setup_key: values.setupKey,
        full_name: values.fullName,
        email: values.email,
        password: values.password
      }
    })
    setUser(result.user)
    setNeedsSetup(false)
    setApiError('')
    return result.user
  }

  async function updatePassword(currentPassword, newPassword) {
    const result = await apiRequest('/auth/password', {
      method: 'POST',
      body: { current_password: currentPassword, new_password: newPassword }
    })
    setUser(result.user)
    return result.user
  }

  async function signOut() {
    if (demoMode) {
      setDemoMode(false)
      return
    }
    await apiRequest('/auth/logout', { method: 'POST' })
    setUser(null)
  }

  function startDemo(role = 'admin') {
    setDemoRole(role)
    setDemoMode(true)
  }

  function switchDemoRole(role) {
    if (role === 'admin' || role === 'employee') setDemoRole(role)
  }

  const profile = demoMode
    ? demoRole === 'admin'
      ? { id: 'demo-admin', full_name: 'Demo Administrator', email: 'preview@nova.example', role: 'admin', must_change_password: false }
      : { id: 'demo-employee', full_name: 'Demo Employee', email: 'employee@nova.example', role: 'employee', must_change_password: false }
    : user
  const session = profile ? { user: { id: profile.id, email: profile.email } } : null
  const value = useMemo(() => ({
    session,
    profile,
    loading,
    profileLoading: false,
    profileError: '',
    apiError,
    needsSetup,
    setupKeyConfigured,
    setupKeyRequired,
    signOut,
    login,
    registerEmployee,
    setupAdmin,
    updatePassword,
    demoMode,
    startDemo,
    switchDemoRole
  }), [session, profile, loading, apiError, needsSetup, setupKeyConfigured, setupKeyRequired, demoMode])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider.')
  return value
}
