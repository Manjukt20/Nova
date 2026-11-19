import { useEffect, useState } from 'react'
import { ArrowRight, Check, Eye, EyeOff, KeyRound, LockKeyhole, Mail, ShieldCheck, Store, UserRound } from 'lucide-react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { session, profile, loading, profileLoading, apiError, needsSetup, setupKeyConfigured, setupKeyRequired, login, registerEmployee, setupAdmin, startDemo } = useAuth()
  const navigate = useNavigate()
  const [role, setRole] = useState('employee')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [setupKey, setSetupKey] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const [registrationNotice, setRegistrationNotice] = useState('')

  useEffect(() => {
    if (session && profile && !profileLoading) {
      navigate(profile.must_change_password ? '/change-password' : '/dashboard', { replace: true })
    }
  }, [session, profile, profileLoading, navigate])

  if (loading || (session && profileLoading)) {
    return <main className="loading-screen"><span className="loading-mark">I<span>.</span></span><div className="spinner"/><p>Preparing your workspace…</p></main>
  }
  if (session && profile) return <Navigate to={profile.must_change_password ? '/change-password' : '/dashboard'} replace />

  async function handleLogin(event) {
    event.preventDefault()
    setFormError('')
    setBusy(true)
    try {
      const signedInUser = await login(email.trim(), password)
      setRole(signedInUser.role)
      navigate(signedInUser.must_change_password ? '/change-password' : '/dashboard', { replace: true })
    } catch (error) {
      setFormError(error.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleSetup(event) {
    event.preventDefault()
    setFormError('')
    setBusy(true)
    try {
      await setupAdmin({ setupKey, fullName: fullName.trim(), email: email.trim(), password })
      navigate('/dashboard', { replace: true })
    } catch (error) {
      setFormError(error.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleRegister(event) {
    event.preventDefault()
    setFormError('')
    setRegistrationNotice('')
    setBusy(true)
    try {
      const result = await registerEmployee(fullName.trim(), email.trim(), password)
      setRegistrationNotice(result.message)
      setRegistering(false)
      setPassword('')
    } catch (error) {
      setFormError(error.message)
    } finally {
      setBusy(false)
    }
  }

  const heading = needsSetup
    ? 'Set up your workspace'
    : registering
      ? 'Create your employee account'
      : 'Sign in to your workspace'

  return (
    <main className="login-layout">
      <section className="login-story">
        <a className="login-brand" href="/login"><span className="brand-symbol">N<span>.</span></span><span className="brand-wordmark">NOVA<small>OPERATIONS</small></span></a>
        <div className="story-content">
          <span className="eyebrow light-eyebrow"><i/>THE STORE TEAM WORKSPACE</span>
          <h1>Better work.<br/><em>Better every day.</em></h1>
          <p>One calm place to keep Shopify operations, store improvements, and team priorities moving.</p>
          <div className="story-points">
            <span><Check size={15}/>See what matters today</span>
            <span><Check size={15}/>Keep Nova and Tone Garage in sync</span>
            <span><Check size={15}/>Move work forward together</span>
          </div>
        </div>
        <div className="story-bottom"><span>NOVA + TONE GARAGE</span><span>WORKSPACE ACCESS <i>·</i> 01</span></div>
      </section>
      <section className="login-panel">
        <div className="login-card">
          <div className="login-heading">
            <span className="login-icon">{needsSetup ? <KeyRound size={19}/> : <LockKeyhole size={19}/>}</span>
            <span className="eyebrow">{needsSetup ? 'FIRST-TIME SETUP' : 'WELCOME BACK'}</span>
            <h2>{heading}</h2>
            <p>{needsSetup ? 'Create the first administrator account for this installation.' : registering ? 'Register now; an administrator must approve your access before you can sign in.' : 'Use your work account to pick up where you left off.'}</p>
          </div>
          {!needsSetup && !registering && <div className="role-switch" role="tablist" aria-label="Choose account type">
            <button role="tab" aria-selected={role === 'employee'} className={role === 'employee' ? 'role-tab active' : 'role-tab'} onClick={() => { setRole('employee'); setFormError('') }}><Store size={15}/>Employee</button>
            <button role="tab" aria-selected={role === 'admin'} className={role === 'admin' ? 'role-tab active' : 'role-tab'} onClick={() => { setRole('admin'); setFormError('') }}><ShieldCheck size={15}/>Administrator</button>
          </div>}
          {registrationNotice && <div className="form-alert form-alert-success" role="status">{registrationNotice}</div>}

          {needsSetup ? <form className="login-form" onSubmit={handleSetup}>
            <label className="form-label">Your name<span className="input-wrap"><UserRound size={16}/><input autoComplete="name" value={fullName} onChange={event => setFullName(event.target.value)} placeholder="Full name" maxLength={100} required/></span></label>
            <label className="form-label">Work email<span className="input-wrap"><Mail size={16}/><input type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@company.com" required/></span></label>
            {setupKeyRequired && <label className="form-label">First-admin setup key<span className="input-wrap"><KeyRound size={16}/><input value={setupKey} onChange={event => setSetupKey(event.target.value)} placeholder="From the server .env file" required/></span></label>}
            <label className="form-label">Create password<span className="input-wrap"><LockKeyhole size={16}/><input type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="At least 12 characters" minLength={12} required/><button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}</button></span></label>
            {setupKeyRequired && !setupKeyConfigured && <div className="form-alert form-alert-info">Set <code>NOVA_SETUP_KEY</code> in the server’s <code>.env</code>, then restart the API before initial setup.</div>}
            {formError && <div className="form-alert form-alert-error" role="alert">{formError}</div>}
            <button className="login-submit" type="submit" disabled={busy || (setupKeyRequired && !setupKeyConfigured)}>{busy ? 'Creating account…' : 'Create administrator account'}<ArrowRight size={17}/></button>
          </form> : registering ? <form className="login-form" onSubmit={handleRegister}>
            <label className="form-label">Your name<span className="input-wrap"><UserRound size={16}/><input autoComplete="name" value={fullName} onChange={event => setFullName(event.target.value)} placeholder="Full name" maxLength={100} required/></span></label>
            <label className="form-label">Work email<span className="input-wrap"><Mail size={16}/><input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@company.com" required/></span></label>
            <label className="form-label">Create password<span className="input-wrap"><LockKeyhole size={16}/><input type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="At least 12 characters" minLength={12} required/><button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}</button></span></label>
            {formError && <div className="form-alert form-alert-error" role="alert">{formError}</div>}
            <button className="login-submit" type="submit" disabled={busy}>{busy ? 'Submitting…' : 'Request employee access'}<ArrowRight size={17}/></button>
          </form> : <form className="login-form" onSubmit={handleLogin}>
            <label className="form-label">Work email<span className="input-wrap"><Mail size={16}/><input type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@company.com" required/></span></label>
            <label className="form-label">Password<span className="input-wrap"><LockKeyhole size={16}/><input type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Enter your password" required/><button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}</button></span></label>
            {formError && <div className="form-alert form-alert-error" role="alert">{formError}</div>}
            <button className="login-submit" type="submit" disabled={busy}>{busy ? 'Please wait…' : `Sign in as ${role === 'admin' ? 'administrator' : 'employee'}`}<ArrowRight size={17}/></button>
          </form>}
          {!needsSetup && !registering && role === 'employee' && <button type="button" className="account-link" onClick={() => { setRegistering(true); setFormError(''); setRegistrationNotice('') }}>New here? Register as an employee</button>}
          {!needsSetup && registering && <button type="button" className="account-link" onClick={() => { setRegistering(false); setFormError('') }}>Already registered? Sign in</button>}

          {apiError && <div className="form-alert form-alert-error api-connection-alert" role="alert">API connection: {apiError} Start the app with <code>npm run dev</code>, or use the demo preview below.</div>}
          <div className="demo-preview">
            <span className="demo-preview-label">PREVIEW WITH SAMPLE DATA</span>
            <p>This preview is not a real sign-in. Changes are temporary and are not saved to the database.</p>
            <div><button onClick={() => { startDemo('employee'); navigate('/dashboard', { replace: true }) }}>Preview employee view</button><button onClick={() => { startDemo('admin'); navigate('/dashboard', { replace: true }) }}>Preview admin view</button></div>
          </div>
          <div className="login-security"><ShieldCheck size={15}/><span>Passwords are securely hashed on the server</span></div>
          <p className="account-help">
            {needsSetup
              ? setupKeyRequired
                ? 'The first-admin setup key is required by the server.'
                : 'Local first-time setup is restricted to this computer.'
              : 'Need access? Ask an administrator to create your account.'}
          </p>
        </div>
        <div className="login-copyright">© {new Date().getFullYear()} NOVA OPERATIONS <span>PRIVATE TEAM ACCESS</span></div>
      </section>
    </main>
  )
}
