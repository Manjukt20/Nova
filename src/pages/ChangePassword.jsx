import { useState } from 'react'
import { ArrowRight, KeyRound, LockKeyhole } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ChangePasswordPage() {
  const { profile, updatePassword, signOut } = useAuth()
  const navigate = useNavigate()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (newPassword !== confirmPassword) {
      setError('The new passwords do not match.')
      return
    }
    setBusy(true)
    try {
      await updatePassword(currentPassword, newPassword)
      navigate('/dashboard', { replace: true })
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="password-page">
      <a className="login-brand" href="/"><span className="brand-symbol">N<span>.</span></span><span className="brand-wordmark">NOVA<small>OPERATIONS</small></span></a>
      <section className="password-card">
        <span className="login-icon"><KeyRound size={19}/></span>
        <span className="eyebrow">{profile.must_change_password ? 'ONE LAST STEP' : 'ACCOUNT SECURITY'}</span>
        <h1>{profile.must_change_password ? 'Set a new password.' : 'Change your password.'}</h1>
        <p>{profile.must_change_password ? 'Enter the temporary password you used to sign in, then choose a new password before entering the workspace.' : 'Choose a new password for your account.'}</p>
        <form className="password-form" onSubmit={submit}>
          <label className="form-label">{profile.must_change_password ? 'Temporary password' : 'Current password'}<span className="input-wrap"><LockKeyhole size={15}/><input type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} required/></span></label>
          <label className="form-label">New password<span className="input-wrap"><LockKeyhole size={15}/><input type="password" autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} minLength={12} required placeholder="At least 12 characters"/></span></label>
          <label className="form-label">Confirm new password<span className="input-wrap"><LockKeyhole size={15}/><input type="password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} minLength={12} required/></span></label>
          {error && <div className="form-alert form-alert-error" role="alert">{error}</div>}
          <button className="login-submit" type="submit" disabled={busy}>{busy ? 'Saving…' : profile.must_change_password ? 'Set password and continue' : 'Update password'}<ArrowRight size={16}/></button>
        </form>
        <button className="password-signout" onClick={() => signOut()}>Sign out instead</button>
      </section>
    </main>
  )
}
