import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from './AuthContext'
import { apiRequest } from '../lib/api'

const TaskContext = createContext(null)
const DEMO_EMPLOYEE_ID = 'demo-employee'
const DEMO_MEMBERS = [
  { id: 'demo-admin', full_name: 'Demo Administrator', role: 'admin' },
  { id: DEMO_EMPLOYEE_ID, full_name: 'Demo Employee', role: 'employee' }
]

function dateOffset(days) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function demoTasks() {
  return [
    { id: 'demo-task-1', title: 'Refresh homepage campaign banner', description: 'Check the seasonal offer and make sure the mobile crop looks balanced.', area: 'Storefront', priority: 'high', status: 'in_progress', due_date: dateOffset(0), assignee_id: DEMO_EMPLOYEE_ID, created_by: 'demo-admin', assignee: DEMO_MEMBERS[1] },
    { id: 'demo-task-2', title: 'Update photos for new arrivals', description: 'Replace product images and review the product page layout.', area: 'Products', priority: 'medium', status: 'todo', due_date: dateOffset(1), assignee_id: DEMO_EMPLOYEE_ID, created_by: 'demo-admin', assignee: DEMO_MEMBERS[1] },
    { id: 'demo-task-3', title: 'Test checkout and shipping rates', description: 'Run a test order through shipping selection and confirmation.', area: 'Quality assurance', priority: 'high', status: 'review', due_date: dateOffset(2), assignee_id: DEMO_EMPLOYEE_ID, created_by: 'demo-admin', assignee: DEMO_MEMBERS[1] },
    { id: 'demo-task-4', title: 'Check app integration health', description: 'Confirm reviews and email integrations are connected.', area: 'Integrations', priority: 'medium', status: 'todo', due_date: dateOffset(3), assignee_id: null, created_by: 'demo-admin', assignee: null },
    { id: 'demo-task-5', title: 'Coordinate Tone Garage catalog updates', description: 'Collect the latest product and availability changes from the team.', area: 'Tone Garage', priority: 'low', status: 'done', due_date: dateOffset(-1), assignee_id: DEMO_EMPLOYEE_ID, created_by: 'demo-admin', assignee: DEMO_MEMBERS[1] }
  ]
}

export function TaskProvider({ children }) {
  const { session, profile, demoMode } = useAuth()
  const [tasks, setTasks] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const refresh = useCallback(async () => {
    if (demoMode) return
    try {
      const result = await apiRequest('/tasks')
      setTasks(result.tasks)
      setError('')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }, [demoMode])

  const refreshMembers = useCallback(async () => {
    if (demoMode) {
      setMembers(DEMO_MEMBERS)
      return
    }
    if (!profile || profile.role !== 'admin') {
      setMembers(profile ? [profile] : [])
      return
    }
    const result = await apiRequest('/users')
    setMembers(result.users.filter(user => user.approved))
  }, [demoMode, profile])

  useEffect(() => {
    if (!session?.user?.id) return undefined
    if (demoMode) {
      setTasks(demoTasks())
      setMembers(DEMO_MEMBERS)
      setError('')
      setLoading(false)
      return undefined
    }
    setLoading(true)
    refresh()
    return undefined
  }, [session?.user?.id, demoMode, refresh])

  useEffect(() => {
    let active = true
    refreshMembers()
      .then(() => { if (active) setError('') })
      .catch(requestError => { if (active) setError(requestError.message) })
    return () => { active = false }
  }, [refreshMembers])

  const saveTask = useCallback(async (values, id) => {
    setError('')
    setNotice('')
    if (demoMode) {
      const assignee = members.find(member => member.id === values.assignee_id) || null
      const task = {
        ...values,
        id: id || `demo-task-${Date.now()}`,
        due_date: values.due_date || null,
        assignee_id: values.assignee_id || null,
        created_by: 'demo-admin',
        assignee
      }
      setTasks(current => id ? current.map(item => item.id === id ? { ...item, ...task } : item) : [task, ...current])
      setNotice(id ? 'Demo task updated.' : 'Demo task created.')
      return true
    }

    try {
      const result = await apiRequest(id ? `/tasks/${encodeURIComponent(id)}` : '/tasks', {
        method: id ? 'PATCH' : 'POST',
        body: values
      })
      setNotice(id ? 'Task updated.' : 'Task created.')
      await refresh()
      return Boolean(result.task)
    } catch (requestError) {
      setError(requestError.message)
      return false
    }
  }, [demoMode, members, refresh])

  const changeStatus = useCallback(async (id, status) => {
    setError('')
    setNotice('')
    if (demoMode) {
      setTasks(current => current.map(task => task.id === id ? { ...task, status } : task))
      setNotice('Demo task status updated.')
      return true
    }
    try {
      await apiRequest(`/tasks/${encodeURIComponent(id)}`, { method: 'PATCH', body: { status } })
      setNotice('Task status updated.')
      await refresh()
      return true
    } catch (requestError) {
      setError(requestError.message)
      return false
    }
  }, [demoMode, refresh])

  const deleteTask = useCallback(async id => {
    setError('')
    setNotice('')
    if (demoMode) {
      setTasks(current => current.filter(task => task.id !== id))
      setNotice('Demo task deleted.')
      return true
    }
    try {
      await apiRequest(`/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' })
      setNotice('Task deleted.')
      await refresh()
      return true
    } catch (requestError) {
      setError(requestError.message)
      return false
    }
  }, [demoMode, refresh])

  const visibleTasks = demoMode && profile?.role === 'employee'
    ? tasks.filter(task => task.assignee_id === profile.id)
    : tasks
  const visibleMembers = demoMode && profile?.role === 'employee' ? [profile] : members
  const value = useMemo(() => ({
    tasks: visibleTasks, members: visibleMembers, loading, error, notice, setError, setNotice, refresh, refreshMembers, saveTask, changeStatus, deleteTask
  }), [visibleTasks, visibleMembers, loading, error, notice, refresh, refreshMembers, saveTask, changeStatus, deleteTask])

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>
}

export function useTasks() {
  const value = useContext(TaskContext)
  if (!value) throw new Error('useTasks must be used inside TaskProvider.')
  return value
}
