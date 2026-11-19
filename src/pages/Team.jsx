import { useEffect, useState } from 'react'
import { Check, KeyRound, Plus, RotateCw, ShieldCheck, UserRound, Users, X } from 'lucide-react'
import { apiRequest } from '../lib/api'
import { useTasks } from '../context/TaskContext'

function EmployeeModal({ member, onClose, onSaved }) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [temporaryPassword, setTemporaryPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (member) {
        await apiRequest(`/users/${encodeURIComponent(member.id)}/reset-password`, {
          method: 'POST',
          body: { temporary_password: temporaryPassword }
        })
      } else {
        await apiRequest('/users', {
          method: 'POST',
          body: { full_name: fullName.trim(), email: email.trim(), temporary_password: temporaryPassword }
        })
      }
      onSaved(member ? 'Temporary password reset. The employee must change it at next sign-in.' : 'Employee account created. Share the temporary password securely.')
      onClose()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <section className="task-editor" role="dialog" aria-modal="true" aria-labelledby="team-modal-title">
        <div className="editor-heading"><div><span className="eyebrow">{member ? 'ACCOUNT ACCESS' : 'TEAM ACCESS'}</span><h2 id="team-modal-title">{member ? 'Reset temporary password' : 'Add an employee'}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={18}/></button></div>
        <form onSubmit={submit}>
          {member ? <div className="member-reset-summary"><span className="member-avatar">{member.full_name.slice(0, 2).toUpperCase()}</span><span><strong>{member.full_name}</strong><small>{member.email}</small></span></div> : <>
            <label className="form-label">Employee name<input value={fullName} onChange={event => setFullName(event.target.value)} autoComplete="name" maxLength={100} required/></label>
            <label className="form-label">Work email<input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required/></label>
          </>}
          <label className="form-label">Temporary password<input type="password" value={temporaryPassword} onChange={event => setTemporaryPassword(event.target.value)} minLength={12} autoComplete="new-password" placeholder="At least 12 characters" required/></label>
          <p className="password-help">The employee will be required to set a new password at their first sign-in. Share this temporary password through a separate secure channel.</p>
          {error && <div className="form-alert form-alert-error" role="alert">{error}</div>}
          <div className="editor-actions"><span/><button type="button" className="button button-outline" onClick={onClose}>Cancel</button><button type="submit" className="button button-dark" disabled={busy}>{busy ? 'Saving…' : member ? 'Reset password' : 'Create account'}</button></div>
        </form>
      </section>
    </div>
  )
}

function formatCreated(value) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
}

export default function TeamPage() {
  const { refreshMembers } = useTasks()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [target, setTarget] = useState(undefined)
  const [approvingId, setApprovingId] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    apiRequest('/users')
      .then(result => { if (active) { setUsers(result.users); setError('') } })
      .catch(requestError => { if (active) setError(requestError.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [refreshKey])

  async function handleSaved(message) {
    setNotice(message)
    setRefreshKey(current => current + 1)
    try {
      await refreshMembers()
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function approveMember(user) {
    setError('')
    setApprovingId(user.id)
    try {
      await apiRequest(`/users/${encodeURIComponent(user.id)}/approve`, { method: 'POST' })
      handleSaved(`${user.full_name} can now sign in.`)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setApprovingId('')
    }
  }

  return (
    <div className="page-stack">
      <section className="page-intro-row">
        <div><span className="eyebrow"><i/>PEOPLE & ACCESS</span><h1>Team <span className="heading-count">{users.length}</span></h1><p>Approve employee registrations so they can be assigned tasks.</p></div>
        <button className="button button-dark" onClick={() => setTarget(null)}><Plus size={16}/>Add employee</button>
      </section>
      {error && <div className="page-alert" role="alert"><span>{error}</span><button onClick={() => setRefreshKey(current => current + 1)} aria-label="Retry loading employees"><RotateCw size={14}/></button></div>}
      {notice && <div className="page-notice" role="status"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss message">×</button></div>}
      <section className="team-panel panel">
        <header className="team-panel-heading"><span className="team-panel-icon"><Users size={18}/></span><span><strong>Workspace members</strong><small>Accounts and access for your store team</small></span><ShieldCheck size={17} className="team-secure-icon"/></header>
        {loading ? <div className="panel-loading">Loading team members…</div> : users.length ? <div className="team-table-wrap"><table className="team-table"><thead><tr><th>PERSON</th><th>ROLE</th><th>ACCOUNT STATUS</th><th>ADDED</th><th/></tr></thead><tbody>
          {users.map(user => <tr key={user.id}>
            <td><span className="team-person"><span className="member-avatar">{user.full_name.slice(0, 2).toUpperCase()}</span><span><strong>{user.full_name}</strong><small>{user.email}</small></span></span></td>
            <td><span className={`role-chip role-${user.role}`}>{user.role === 'admin' ? <ShieldCheck size={12}/> : <UserRound size={12}/>} {user.role === 'admin' ? 'Administrator' : 'Employee'}</span></td>
            <td><span className={!user.approved || user.must_change_password ? 'account-status status-pending' : 'account-status'}><i/>{!user.approved ? 'Awaiting approval' : user.must_change_password ? 'Password update required' : 'Active'}</span></td>
            <td className="team-created">{formatCreated(user.created_at)}</td>
            <td>{user.role === 'employee' && (!user.approved
              ? <button className="reset-password-button" onClick={() => approveMember(user)} disabled={approvingId === user.id}><Check size={13}/>{approvingId === user.id ? 'Approving…' : 'Approve'}</button>
              : <button className="reset-password-button" onClick={() => setTarget(user)}><KeyRound size={13}/>Reset password</button>)}</td>
          </tr>)}
        </tbody></table></div> : <div className="panel-empty"><Users size={21}/><strong>No team accounts yet</strong><span>Add an employee account to assign store tasks.</span></div>}
      </section>
      {target !== undefined && <EmployeeModal member={target} onClose={() => setTarget(undefined)} onSaved={handleSaved}/>}
    </div>
  )
}
