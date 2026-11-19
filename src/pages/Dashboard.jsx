import { useMemo } from 'react'
import { ArrowRight, CalendarDays, CheckCircle2, Circle, Clock3, Plus, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTasks } from '../context/TaskContext'

const statusNames = { todo: 'To do', in_progress: 'In progress', review: 'In review', done: 'Complete' }

function todayString() {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

function formatDue(value) {
  if (!value) return 'No due date'
  return new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(`${value}T00:00:00`))
}

export default function Dashboard() {
  const { profile } = useAuth()
  const { tasks, loading, error, setError } = useTasks()
  const today = todayString()
  const metrics = useMemo(() => ({
    open: tasks.filter(task => task.status !== 'done').length,
    overdue: tasks.filter(task => task.status !== 'done' && task.due_date && task.due_date < today).length,
    dueToday: tasks.filter(task => task.status !== 'done' && task.due_date === today).length,
    done: tasks.filter(task => task.status === 'done').length
  }), [tasks, today])
  const dueSoon = tasks.filter(task => task.status !== 'done' && task.due_date && task.due_date >= today)
    .sort((a, b) => a.due_date.localeCompare(b.due_date)).slice(0, 5)
  const completion = tasks.length ? Math.round((metrics.done / tasks.length) * 100) : 0

  return (
    <div className="page-stack">
      <section className="dashboard-welcome">
        <div><span className="eyebrow"><i/>YOUR WORKSPACE, AT A GLANCE</span>
          <h1>Good morning, <em>{profile.full_name?.split(' ')[0] || 'there'}.</em></h1>
          <p>Here’s what’s happening across your store operations today.</p>
        </div>
        {profile.role === 'admin' && <Link className="button button-dark" to="/tasks?new=1"><Plus size={16}/>Create a task</Link>}
      </section>

      {error && <div className="page-alert" role="alert"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}
      <section className="metric-grid" aria-label="Task summary">
        <article className="metric-card"><span className="metric-icon metric-icon-dark"><Circle size={17}/></span><span className="metric-label">OPEN TASKS</span><strong>{loading ? '—' : metrics.open}</strong><small>Work in progress</small></article>
        <article className="metric-card"><span className="metric-icon metric-icon-amber"><Clock3 size={17}/></span><span className="metric-label">OVERDUE</span><strong>{loading ? '—' : metrics.overdue}</strong><small>{metrics.overdue ? 'Needs attention' : 'Nothing overdue'}</small></article>
        <article className="metric-card"><span className="metric-icon metric-icon-blue"><CalendarDays size={17}/></span><span className="metric-label">DUE TODAY</span><strong>{loading ? '—' : metrics.dueToday}</strong><small>Keep these on your radar</small></article>
        <article className="metric-card"><span className="metric-icon metric-icon-green"><CheckCircle2 size={17}/></span><span className="metric-label">COMPLETED</span><strong>{loading ? '—' : metrics.done}</strong><small>Tasks wrapped up</small></article>
      </section>

      <div className="dashboard-grid">
        <section className="panel upcoming-panel">
          <div className="panel-heading"><div><span className="eyebrow">NEXT UP</span><h2>Upcoming work</h2></div><Link to="/tasks" className="quiet-link">View all <ArrowRight size={14}/></Link></div>
          {loading ? <div className="panel-loading">Loading your tasks…</div> : dueSoon.length ? (
            <div className="upcoming-list">{dueSoon.map(task => (
              <Link to="/tasks" className="upcoming-item" key={task.id}>
                <span className={`task-status-mark status-${task.status}`}><Circle size={13} fill="currentColor"/></span>
                <span className="upcoming-copy"><strong>{task.title}</strong><small>{task.area} <i>·</i> {task.assignee?.full_name || 'Unassigned'}</small></span>
                <span className="upcoming-date">{formatDue(task.due_date)}</span>
              </Link>
            ))}</div>
          ) : <div className="panel-empty"><CalendarDays size={21}/><strong>No upcoming tasks</strong><span>When tasks are assigned, they’ll show up here.</span></div>}
        </section>

        <section className="panel progress-panel">
          <div className="panel-heading"><div><span className="eyebrow">TEAM MOMENTUM</span><h2>Progress snapshot</h2></div><TrendingUp size={18} className="panel-heading-icon"/></div>
          <div className="progress-summary"><strong>{loading ? '—' : `${completion}%`}</strong><span>of all tasks completed</span></div>
          <div className="progress-track"><span style={{ width: `${completion}%` }}/></div>
          <div className="progress-foot"><span>{metrics.done} completed</span><span>{metrics.open} still open</span></div>
          <div className="team-callout"><span className="callout-check"><CheckCircle2 size={17}/></span><span><strong>Small steps count.</strong><small>Keep your team aligned on the next important update.</small></span></div>
          <Link to="/calendar" className="progress-calendar"><CalendarDays size={15}/>Check the team calendar<ArrowRight size={14}/></Link>
        </section>
      </div>
      {!loading && tasks.length === 0 && <section className="first-task-callout"><div><span className="eyebrow">A FRESH START</span><h2>Your shared task list is ready.</h2><p>Create a task and assign it to the right person to get the team moving.</p></div>{profile.role === 'admin' && <Link to="/tasks?new=1" className="button button-dark"><Plus size={16}/>Create first task</Link>}</section>}
    </div>
  )
}
