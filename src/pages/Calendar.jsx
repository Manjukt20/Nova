import { useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, CalendarDays, Circle, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTasks } from '../context/TaskContext'

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function monthLabel(date) {
  return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(date)
}

function shortDate(value) {
  return new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(`${value}T00:00:00`))
}

const statusNames = { todo: 'To do', in_progress: 'In progress', review: 'In review', done: 'Complete' }

export default function CalendarPage() {
  const { profile } = useAuth()
  const { tasks, loading, error } = useTasks()
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState(dateKey(new Date()))
  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1)
    const offset = (first.getDay() + 6) % 7
    const start = new Date(first)
    start.setDate(first.getDate() - offset)
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start)
      date.setDate(start.getDate() + index)
      return date
    })
  }, [month])
  const tasksByDate = useMemo(() => tasks.reduce((map, task) => {
    if (task.due_date) map[task.due_date] = [...(map[task.due_date] || []), task]
    return map
  }, {}), [tasks])
  const selectedTasks = (tasksByDate[selectedDate] || []).slice().sort((a, b) => a.title.localeCompare(b.title))

  function moveMonth(amount) {
    const next = new Date(month.getFullYear(), month.getMonth() + amount, 1)
    setMonth(next)
    setSelectedDate(dateKey(next))
  }

  return (
    <div className="page-stack">
      <section className="page-intro-row">
        <div><span className="eyebrow"><i/>SCHEDULE & DEADLINES</span><h1>Team calendar</h1><p>Stay ahead of task deadlines across Nova and Tone Garage.</p></div>
        {profile.role === 'admin' && <Link className="button button-dark" to="/tasks?new=1"><Plus size={16}/>Schedule a task</Link>}
      </section>
      {error && <div className="page-alert" role="alert"><span>{error}</span></div>}
      <section className="calendar-layout panel">
        <div className="calendar-main">
          <header className="calendar-header">
            <div><span className="eyebrow">MONTH VIEW</span><h2>{monthLabel(month)}</h2></div>
            <div className="calendar-actions"><button className="today-button" onClick={() => { const today = new Date(); setMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDate(dateKey(today)) }}>Today</button><button aria-label="Previous month" onClick={() => moveMonth(-1)}><ArrowLeft size={16}/></button><button aria-label="Next month" onClick={() => moveMonth(1)}><ArrowRight size={16}/></button></div>
          </header>
          <div className="calendar-grid">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <span className="calendar-weekday" key={day}>{day}</span>)}
            {days.map(date => {
              const key = dateKey(date)
              const dayTasks = tasksByDate[key] || []
              const currentMonth = date.getMonth() === month.getMonth()
              return <button key={key} className={`calendar-day ${currentMonth ? '' : 'calendar-day-muted'} ${selectedDate === key ? 'calendar-day-selected' : ''} ${key === dateKey(new Date()) ? 'calendar-day-today' : ''}`} onClick={() => setSelectedDate(key)}>
                <span className="calendar-date-number">{date.getDate()}</span>
                <span className="calendar-event-dots">{dayTasks.slice(0, 3).map(task => <i key={task.id} className={`event-dot event-${task.status}`}/>)}{dayTasks.length > 3 && <small>+{dayTasks.length - 3}</small>}</span>
                <span className="calendar-day-tasks">{dayTasks.slice(0, 2).map(task => <span key={task.id} className={`calendar-task-chip event-${task.status}`}>{task.title}</span>)}</span>
              </button>
            })}
          </div>
          <div className="calendar-legend"><span><i className="event-todo"/>To do</span><span><i className="event-in_progress"/>In progress</span><span><i className="event-review"/>In review</span><span><i className="event-done"/>Complete</span></div>
        </div>
        <aside className="agenda-panel">
          <span className="eyebrow">DAY AGENDA</span>
          <h3>{shortDate(selectedDate)}</h3>
          <span className="agenda-count">{selectedTasks.length} {selectedTasks.length === 1 ? 'task' : 'tasks'} due</span>
          {loading ? <div className="panel-loading">Loading…</div> : selectedTasks.length ? (
            <div className="agenda-list">{selectedTasks.map(task => <article className="agenda-item" key={task.id}>
              <span className={`agenda-status status-${task.status}`}><Circle size={11} fill="currentColor"/></span>
              <div><strong>{task.title}</strong><span>{task.area} <i>·</i> {task.assignee?.full_name || 'Unassigned'}</span><small>{statusNames[task.status] || task.status}</small></div>
            </article>)}</div>
          ) : <div className="agenda-empty"><span className="agenda-empty-icon"><CalendarDays size={20}/></span><strong>Nothing scheduled</strong><p>No task due on this day.</p>{profile.role === 'admin' && <Link to="/tasks?new=1">Add a task <ArrowRight size={13}/></Link>}</div>}
          <div className="agenda-footer"><span>Showing assigned tasks</span><span className="secure-dot"/></div>
        </aside>
      </section>
    </div>
  )
}
