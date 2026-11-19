import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowDownUp, CalendarDays, Check, ChevronDown, Circle, LayoutGrid, List, Plus, Search, Settings2, Tag, Trash2, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTasks } from '../context/TaskContext'

const AREAS = ['Storefront', 'Products', 'Integrations', 'Quality assurance', 'Tone Garage', 'Operations']
const STATUSES = [
  { value: 'todo', label: 'To do' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'review', label: 'In review' },
  { value: 'done', label: 'Complete' }
]
const PRIORITIES = ['low', 'medium', 'high']

function formatDue(value) {
  if (!value) return 'No due date'
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(`${value}T00:00:00`))
}

function TaskEditor({ task, members, onClose, onSave, onDelete, error }) {
  const [form, setForm] = useState(() => task ? {
    title: task.title,
    description: task.description || '',
    area: task.area,
    priority: task.priority,
    status: task.status,
    due_date: task.due_date || '',
    assignee_id: task.assignee_id || ''
  } : {
    title: '', description: '', area: 'Storefront', priority: 'medium',
    status: 'todo', due_date: '', assignee_id: ''
  })
  const [saving, setSaving] = useState(false)

  function update(event) {
    setForm(current => ({ ...current, [event.target.name]: event.target.value }))
  }

  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    await onSave(form, task?.id)
    setSaving(false)
  }

  return (
    <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <section className="task-editor" role="dialog" aria-modal="true" aria-labelledby="editor-title">
        <div className="editor-heading"><div><span className="eyebrow">{task ? 'TASK DETAILS' : 'NEW WORK ITEM'}</span><h2 id="editor-title">{task ? 'Update task' : 'Create a task'}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={18}/></button></div>
        <form onSubmit={submit}>
          <label className="form-label">Task name<input name="title" value={form.title} onChange={update} placeholder="What needs to get done?" maxLength={120} required autoFocus/></label>
          <label className="form-label">Description<textarea name="description" value={form.description} onChange={update} placeholder="Add context so your teammate has what they need…" rows="3" maxLength={1000}/></label>
          <div className="editor-grid">
            <label className="form-label">Area<select name="area" value={form.area} onChange={update}>{AREAS.map(area => <option key={area}>{area}</option>)}</select></label>
            <label className="form-label">Assign to<select name="assignee_id" value={form.assignee_id} onChange={update}><option value="">Unassigned</option>{members.map(member => <option key={member.id} value={member.id}>{member.full_name || 'Team member'}{member.role === 'admin' ? ' · Admin' : ''}</option>)}</select></label>
            <label className="form-label">Priority<select name="priority" value={form.priority} onChange={update}>{PRIORITIES.map(priority => <option key={priority} value={priority}>{priority[0].toUpperCase() + priority.slice(1)}</option>)}</select></label>
            <label className="form-label">Status<select name="status" value={form.status} onChange={update}>{STATUSES.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label>
            <label className="form-label form-wide">Due date<input name="due_date" type="date" value={form.due_date} onChange={update}/></label>
          </div>
          {error && <div className="form-alert form-alert-error" role="alert">{error}</div>}
          <div className="editor-actions">
            {task && <button className="text-danger" type="button" onClick={() => onDelete(task.id)}><Trash2 size={15}/>Delete task</button>}
            <span/>
            <button type="button" className="button button-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="button button-dark" disabled={saving}>{saving ? 'Saving…' : task ? 'Save changes' : 'Create task'}</button>
          </div>
        </form>
      </section>
    </div>
  )
}

function StatusPicker({ task, onChange }) {
  const label = STATUSES.find(status => status.value === task.status)?.label || task.status
  return <label className={`status-picker status-picker-${task.status}`}><span className="sr-only">Status for {task.title}</span><select value={task.status} onChange={event => onChange(task.id, event.target.value)}>{STATUSES.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}</select><span>{label}</span><ChevronDown size={12}/></label>
}

function TaskCard({ task, canManage, onEdit, onStatusChange }) {
  return (
    <article className="work-card">
      <div className="work-card-top"><span className={`priority-pill priority-${task.priority}`}>{task.priority}</span>{canManage && <button className="subtle-icon" onClick={() => onEdit(task)} aria-label={`Edit ${task.title}`}><Settings2 size={15}/></button>}</div>
      {canManage ? <button className="work-title" onClick={() => onEdit(task)}>{task.title}</button> : <h3 className="work-title-static">{task.title}</h3>}
      {task.description && <p className="work-description">{task.description}</p>}
      <span className="work-area"><Tag size={12}/>{task.area}</span>
      <div className="work-card-bottom"><span className="work-due"><CalendarDays size={13}/>{formatDue(task.due_date)}</span><span className="assigned-person">{task.assignee?.full_name?.slice(0, 2).toUpperCase() || '—'}<small>{task.assignee?.full_name || 'Unassigned'}</small></span></div>
      <StatusPicker task={task} onChange={onStatusChange}/>
    </article>
  )
}

export default function TasksPage() {
  const { profile } = useAuth()
  const { tasks, members, loading, error, notice, setError, setNotice, saveTask, changeStatus, deleteTask } = useTasks()
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeArea, setActiveArea] = useState('All areas')
  const [activeStatus, setActiveStatus] = useState('all')
  const [priority, setPriority] = useState('all')
  const [search, setSearch] = useState('')
  const [view, setView] = useState('board')
  const [editing, setEditing] = useState(null)
  const [creating, setCreating] = useState(false)
  const canManage = profile.role === 'admin'

  useEffect(() => {
    if (searchParams.get('new') === '1' && canManage) {
      setCreating(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams, canManage])

  const visibleTasks = useMemo(() => tasks.filter(task => {
    const matchesArea = activeArea === 'All areas' || task.area === activeArea
    const matchesStatus = activeStatus === 'all' || task.status === activeStatus
    const matchesPriority = priority === 'all' || task.priority === priority
    const query = search.trim().toLowerCase()
    const matchesSearch = !query || `${task.title} ${task.description || ''} ${task.area} ${task.assignee?.full_name || ''}`.toLowerCase().includes(query)
    return matchesArea && matchesStatus && matchesPriority && matchesSearch
  }), [tasks, activeArea, activeStatus, priority, search])

  async function handleSave(values, id) {
    const saved = await saveTask(values, id)
    if (saved) {
      setEditing(null)
      setCreating(false)
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this task? This cannot be undone.')) return
    if (await deleteTask(id)) setEditing(null)
  }

  return (
    <div className="page-stack">
      <section className="page-intro-row">
        <div><span className="eyebrow"><i/>WORK MANAGEMENT</span><h1>Tasks <span className="heading-count">{tasks.length}</span></h1><p>Keep store updates clear, assigned, and moving.</p></div>
        {canManage && <button className="button button-dark" onClick={() => { setError(''); setCreating(true) }}><Plus size={16}/>New task</button>}
      </section>
      {(error || notice) && <div className={error ? 'page-alert' : 'page-notice'} role={error ? 'alert' : 'status'}><span>{error || notice}</span><button onClick={() => { setError(''); setNotice('') }} aria-label="Dismiss message">×</button></div>}
      <section className="task-workspace panel">
        <div className="task-toolbar">
          <label className="task-search"><Search size={16}/><input aria-label="Search tasks" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search tasks, areas, people…"/>{search && <button onClick={() => setSearch('')} aria-label="Clear search"><X size={13}/></button>}</label>
          <label className="toolbar-select"><span>Area</span><select aria-label="Filter by area" value={activeArea} onChange={event => setActiveArea(event.target.value)}><option>All areas</option>{AREAS.map(area => <option key={area}>{area}</option>)}</select><ChevronDown size={13}/></label>
          <label className="toolbar-select"><span>Status</span><select aria-label="Filter by status" value={activeStatus} onChange={event => setActiveStatus(event.target.value)}><option value="all">All statuses</option>{STATUSES.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}</select><ChevronDown size={13}/></label>
          <label className="toolbar-select priority-filter"><span>Priority</span><select aria-label="Filter by priority" value={priority} onChange={event => setPriority(event.target.value)}><option value="all">All</option>{PRIORITIES.map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select><ChevronDown size={13}/></label>
          <div className="view-switch" aria-label="Task layout">
            <button className={view === 'board' ? 'view-active' : ''} onClick={() => setView('board')} aria-label="Board view"><LayoutGrid size={15}/></button>
            <button className={view === 'list' ? 'view-active' : ''} onClick={() => setView('list')} aria-label="List view"><List size={15}/></button>
          </div>
        </div>
        <div className="task-results-meta"><span>{loading ? 'Loading tasks…' : `${visibleTasks.length} ${visibleTasks.length === 1 ? 'task' : 'tasks'}`}</span><span><ArrowDownUp size={13}/> Due date</span></div>
        {loading ? <div className="panel-loading">Loading your shared tasks…</div> : view === 'board' ? (
          <div className="task-board">
            {STATUSES.map(status => {
              const lane = visibleTasks.filter(task => task.status === status.value)
              return <section className="task-lane" key={status.value}>
                <header className="lane-heading"><span className={`lane-dot lane-dot-${status.value}`}><Circle size={10} fill="currentColor"/></span><strong>{status.label}</strong><span className="lane-count">{lane.length}</span></header>
                <div className="lane-content">{lane.map(task => <TaskCard key={task.id} task={task} canManage={canManage} onEdit={task => { setError(''); setEditing(task) }} onStatusChange={changeStatus}/>)}{!lane.length && <div className="lane-empty">Nothing here yet</div>}</div>
              </section>
            })}
          </div>
        ) : (
          <div className="task-table-wrap"><table className="task-table"><thead><tr><th>Task</th><th>Area</th><th>Assignee</th><th>Due date</th><th>Priority</th><th>Status</th>{canManage && <th/>}</tr></thead><tbody>
            {visibleTasks.map(task => <tr key={task.id}><td>{canManage ? <button className="table-task-title" onClick={() => { setError(''); setEditing(task) }}>{task.title}</button> : task.title}{task.description && <small>{task.description}</small>}</td><td>{task.area}</td><td>{task.assignee?.full_name || 'Unassigned'}</td><td>{formatDue(task.due_date)}</td><td><span className={`priority-pill priority-${task.priority}`}>{task.priority}</span></td><td><StatusPicker task={task} onChange={changeStatus}/></td>{canManage && <td><button className="subtle-icon" onClick={() => { setError(''); setEditing(task) }} aria-label={`Edit ${task.title}`}><Settings2 size={15}/></button></td>}</tr>)}
          </tbody></table>
          {!visibleTasks.length && <div className="panel-empty"><Search size={20}/><strong>No tasks found</strong><span>Try adjusting your filters.</span></div>}</div>
        )}
        {!loading && view === 'board' && !visibleTasks.length && <div className="panel-empty board-no-results"><Search size={20}/><strong>No tasks found</strong><span>Try adjusting your filters.</span></div>}
      </section>
      {canManage && (creating || editing) && <TaskEditor task={editing} members={members} error={error} onClose={() => { setCreating(false); setEditing(null); setError('') }} onSave={handleSave} onDelete={handleDelete}/>}
    </div>
  )
}
