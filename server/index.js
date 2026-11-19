import 'dotenv/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes } from 'node:crypto'
import express from 'express'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { db } from './db.js'
import {
  constantTimeStringEqual, hashPassword, hashSessionToken, newId,
  SESSION_COOKIE, SESSION_DURATION_MS, verifyPassword
} from './security.js'

const serverDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectDirectory = path.dirname(serverDirectory)
const production = process.env.NODE_ENV === 'production'
const serveStatic = production || process.argv.includes('--serve-static')
const port = Number(process.env.PORT || process.env.API_PORT || 3001)
const host = production ? '0.0.0.0' : '127.0.0.1'
const app = express()
const areas = new Set(['Storefront', 'Products', 'Integrations', 'Quality assurance', 'Tone Garage', 'Operations'])
const priorities = new Set(['low', 'medium', 'high'])
const statuses = new Set(['todo', 'in_progress', 'review', 'done'])
const allowedTaskFields = new Set(['title', 'description', 'area', 'priority', 'status', 'due_date', 'assignee_id'])

app.set('trust proxy', production ? 1 : false)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      imgSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'"],
      scriptSrcAttr: ["'none'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com']
    }
  }
}))
app.use(express.json({ limit: '30kb' }))
app.use(cookieParser())
app.use('/api', (req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.get('x-requested-with') !== 'fetch') {
    return res.status(403).json({ error: 'Request could not be verified.' })
  }
  next()
})

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' }
})

function publicUser(row) {
  return {
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    role: row.role,
    must_change_password: Boolean(row.must_change_password),
    approved: Boolean(row.approved),
    created_at: row.created_at
  }
}

function validEmail(value) {
  return typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function validPassword(value) {
  return typeof value === 'string' && value.length >= 12 && value.length <= 200
}

function validDate(value) {
  if (value === null || value === '') return true
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
}

function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: production,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DURATION_MS
  })
}

function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: production,
    sameSite: 'lax',
    path: '/'
  })
}

function loadUser(req, res, next) {
  const token = req.cookies[SESSION_COOKIE]
  if (!token) return next()

  const tokenHash = hashSessionToken(token)
  const row = db.prepare(`
    select u.*, s.token_hash
    from sessions s join users u on u.id = s.user_id
    where s.token_hash = ? and s.expires_at > ?
  `).get(tokenHash, Date.now())

  if (!row) {
    clearSessionCookie(res)
    return next()
  }
  req.user = row
  req.sessionTokenHash = row.token_hash
  next()
}

function requireUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Sign in to continue.' })
  next()
}

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Sign in to continue.' })
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Administrator access is required.' })
  next()
}

function reportError(res, error) {
  console.error(error)
  return res.status(500).json({ error: 'The request could not be completed. Please try again.' })
}

function taskRow(row) {
  if (!row) return null
  const { assignee_name: assigneeName, ...task } = row
  return {
    ...task,
    assignee: task.assignee_id ? { id: task.assignee_id, full_name: assigneeName } : null
  }
}

function getTask(id) {
  return taskRow(db.prepare(`
    select t.*, u.full_name as assignee_name
    from tasks t left join users u on u.id = t.assignee_id
    where t.id = ?
  `).get(id))
}

function validateTask(values) {
  if (typeof values.title !== 'string' || !values.title.trim() || values.title.trim().length > 120) {
    return 'Enter a task name of 1 to 120 characters.'
  }
  if (typeof values.description !== 'string' || values.description.length > 2000) {
    return 'Task details must be 2,000 characters or fewer.'
  }
  if (!areas.has(values.area)) return 'Choose a valid task area.'
  if (!priorities.has(values.priority)) return 'Choose a valid priority.'
  if (!statuses.has(values.status)) return 'Choose a valid status.'
  if (!validDate(values.due_date)) return 'Enter a valid due date.'
  if (values.assignee_id !== null && values.assignee_id !== '' && typeof values.assignee_id !== 'string') {
    return 'Choose a valid assignee.'
  }
  return ''
}

app.use('/api', loadUser)

app.get('/api/health', (_req, res) => res.json({ ok: true }))

app.get('/api/auth/setup-status', (_req, res) => {
  const userCount = db.prepare('select count(*) as count from users').get().count
  res.json({
    setup_required: userCount === 0,
    setup_key_configured: Boolean(process.env.NOVA_SETUP_KEY),
    setup_key_required: production || Boolean(process.env.NOVA_SETUP_KEY)
  })
})

app.post('/api/auth/setup', authLimiter, async (req, res) => {
  const { setup_key: setupKey, full_name: fullName, email, password } = req.body || {}
  if (production && !process.env.NOVA_SETUP_KEY) {
    return res.status(503).json({ error: 'Set NOVA_SETUP_KEY in the server .env before creating the first administrator.' })
  }
  if (process.env.NOVA_SETUP_KEY && !constantTimeStringEqual(String(setupKey || ''), process.env.NOVA_SETUP_KEY)) {
    return res.status(403).json({ error: 'The setup key is not valid.' })
  }
  if (typeof fullName !== 'string' || !fullName.trim() || fullName.trim().length > 100 || !validEmail(email) || !validPassword(password)) {
    return res.status(400).json({ error: 'Enter your name, a valid email, and a password of at least 12 characters.' })
  }

  try {
    const { salt, hash } = await hashPassword(password)
    const user = { id: newId(), email: email.trim().toLowerCase(), full_name: fullName.trim(), role: 'admin', password_hash: hash, password_salt: salt, must_change_password: 0, approved: 1 }
    const createFirstAdmin = db.transaction(() => {
      if (db.prepare('select count(*) as count from users').get().count !== 0) return false
      db.prepare(`
        insert into users (id, email, full_name, role, password_hash, password_salt, must_change_password, approved)
        values (@id, @email, @full_name, @role, @password_hash, @password_salt, @must_change_password, @approved)
      `).run(user)
      return true
    })
    if (!createFirstAdmin()) return res.status(409).json({ error: 'Initial setup is already complete. Sign in instead.' })

    const token = randomBytes(32).toString('hex')
    db.prepare('insert into sessions (token_hash, user_id, expires_at) values (?, ?, ?)').run(hashSessionToken(token), user.id, Date.now() + SESSION_DURATION_MS)
    setSessionCookie(res, token)
    res.status(201).json({ user: publicUser({ ...user, created_at: new Date().toISOString() }) })
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'An account already uses that email.' })
    return reportError(res, error)
  }
})

app.post('/api/auth/register', authLimiter, async (req, res) => {
  const { full_name: fullName, email, password } = req.body || {}
  if (!db.prepare("select id from users where role = 'admin' and approved = 1 limit 1").get()) {
    return res.status(503).json({ error: 'Administrator setup must be completed before employees can register.' })
  }
  if (typeof fullName !== 'string' || !fullName.trim() || fullName.trim().length > 100 || !validEmail(email) || !validPassword(password)) {
    return res.status(400).json({ error: 'Enter your name, a valid email, and a password of at least 12 characters.' })
  }

  try {
    const { salt, hash } = await hashPassword(password)
    const user = {
      id: newId(),
      email: email.trim().toLowerCase(),
      full_name: fullName.trim(),
      role: 'employee',
      password_hash: hash,
      password_salt: salt,
      must_change_password: 0,
      approved: 0
    }
    db.prepare(`
      insert into users (id, email, full_name, role, password_hash, password_salt, must_change_password, approved)
      values (@id, @email, @full_name, @role, @password_hash, @password_salt, @must_change_password, @approved)
    `).run(user)
    res.status(201).json({ message: 'Registration submitted. An administrator must approve your account before you can sign in.' })
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'An account already uses that email.' })
    return reportError(res, error)
  }
})

app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { email, password } = req.body || {}
  if (!validEmail(email) || typeof password !== 'string' || password.length > 200) {
    return res.status(400).json({ error: 'Enter a valid email and password.' })
  }
  try {
    const user = db.prepare('select * from users where email = ? collate nocase').get(email.trim())
    const valid = user
      ? await verifyPassword(password, user.password_salt, user.password_hash)
      : await hashPassword(password).then(() => false)
    if (!user || !valid) return res.status(401).json({ error: 'Email or password is incorrect.' })
    if (!user.approved) return res.status(403).json({ error: 'Your account is waiting for administrator approval.' })

    const token = randomBytes(32).toString('hex')
    const tokenHash = hashSessionToken(token)
    const transaction = db.transaction(() => {
      db.prepare('delete from sessions where user_id = ? and expires_at <= ?').run(user.id, Date.now())
      db.prepare('insert into sessions (token_hash, user_id, expires_at) values (?, ?, ?)').run(tokenHash, user.id, Date.now() + SESSION_DURATION_MS)
    })
    transaction()
    setSessionCookie(res, token)
    res.json({ user: publicUser(user) })
  } catch (error) {
    return reportError(res, error)
  }
})

app.get('/api/auth/me', (req, res) => {
  res.json({ user: req.user ? publicUser(req.user) : null })
})

app.post('/api/auth/logout', requireUser, (req, res) => {
  db.prepare('delete from sessions where token_hash = ?').run(req.sessionTokenHash)
  clearSessionCookie(res)
  res.json({ ok: true })
})

app.post('/api/auth/password', requireUser, async (req, res) => {
  const { current_password: currentPassword, new_password: newPassword } = req.body || {}
  if (typeof currentPassword !== 'string' || !validPassword(newPassword)) {
    return res.status(400).json({ error: 'Enter your current password and a new password of at least 12 characters.' })
  }
  try {
    const currentUser = db.prepare('select * from users where id = ?').get(req.user.id)
    if (!await verifyPassword(currentPassword, currentUser.password_salt, currentUser.password_hash)) {
      return res.status(400).json({ error: 'Your current password is incorrect.' })
    }
    const { salt, hash } = await hashPassword(newPassword)
    db.prepare('update users set password_salt = ?, password_hash = ?, must_change_password = 0 where id = ?').run(salt, hash, req.user.id)
    db.prepare('delete from sessions where user_id = ? and token_hash != ?').run(req.user.id, req.sessionTokenHash)
    const updatedUser = db.prepare('select * from users where id = ?').get(req.user.id)
    res.json({ user: publicUser(updatedUser) })
  } catch (error) {
    return reportError(res, error)
  }
})

app.get('/api/users', requireAdmin, (_req, res) => {
  const users = db.prepare('select id, email, full_name, role, must_change_password, approved, created_at from users order by full_name collate nocase').all()
  res.json({ users: users.map(publicUser) })
})

app.post('/api/users', requireAdmin, async (req, res) => {
  const { full_name: fullName, email, temporary_password: password } = req.body || {}
  if (typeof fullName !== 'string' || !fullName.trim() || fullName.trim().length > 100 || !validEmail(email) || !validPassword(password)) {
    return res.status(400).json({ error: 'Enter a name, valid email, and temporary password of at least 12 characters.' })
  }
  try {
    const { salt, hash } = await hashPassword(password)
    const user = { id: newId(), email: email.trim().toLowerCase(), full_name: fullName.trim(), role: 'employee', password_hash: hash, password_salt: salt, must_change_password: 1, approved: 1 }
    db.prepare(`
      insert into users (id, email, full_name, role, password_hash, password_salt, must_change_password, approved)
      values (@id, @email, @full_name, @role, @password_hash, @password_salt, @must_change_password, @approved)
    `).run(user)
    res.status(201).json({ user: publicUser({ ...user, created_at: new Date().toISOString() }) })
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'An account already uses that email.' })
    return reportError(res, error)
  }
})

app.post('/api/users/:id/approve', requireAdmin, (req, res) => {
  const target = db.prepare('select id, role, approved from users where id = ?').get(req.params.id)
  if (!target) return res.status(404).json({ error: 'Account not found.' })
  if (target.role !== 'employee') return res.status(400).json({ error: 'Only employee accounts can be approved.' })
  if (target.approved) return res.status(409).json({ error: 'This employee account is already approved.' })

  db.prepare('update users set approved = 1 where id = ?').run(target.id)
  res.json({ ok: true })
})

app.post('/api/users/:id/reset-password', requireAdmin, async (req, res) => {
  const { temporary_password: password } = req.body || {}
  if (!validPassword(password)) return res.status(400).json({ error: 'Temporary passwords must be at least 12 characters.' })
  try {
    const target = db.prepare('select id from users where id = ?').get(req.params.id)
    if (!target) return res.status(404).json({ error: 'Account not found.' })
    const { salt, hash } = await hashPassword(password)
    db.prepare('update users set password_salt = ?, password_hash = ?, must_change_password = 1 where id = ?').run(salt, hash, target.id)
    db.prepare('delete from sessions where user_id = ?').run(target.id)
    res.json({ ok: true })
  } catch (error) {
    return reportError(res, error)
  }
})

app.get('/api/tasks', requireUser, (req, res) => {
  const rows = req.user.role === 'admin'
    ? db.prepare('select t.*, u.full_name as assignee_name from tasks t left join users u on u.id = t.assignee_id order by t.due_date is null, t.due_date, t.created_at desc').all()
    : db.prepare('select t.*, u.full_name as assignee_name from tasks t left join users u on u.id = t.assignee_id where t.assignee_id = ? order by t.due_date is null, t.due_date, t.created_at desc').all(req.user.id)
  res.json({ tasks: rows.map(taskRow) })
})

app.post('/api/tasks', requireAdmin, (req, res) => {
  const values = {
    title: req.body?.title,
    description: req.body?.description ?? '',
    area: req.body?.area,
    priority: req.body?.priority,
    status: req.body?.status,
    due_date: req.body?.due_date || null,
    assignee_id: req.body?.assignee_id || null
  }
  const validationError = validateTask(values)
  if (validationError) return res.status(400).json({ error: validationError })
  try {
    if (values.assignee_id && !db.prepare('select id from users where id = ? and approved = 1').get(values.assignee_id)) {
      return res.status(400).json({ error: 'The selected assignee does not exist or is awaiting approval.' })
    }
    const id = newId()
    db.prepare(`
      insert into tasks (id, title, description, area, priority, status, due_date, assignee_id, created_by)
      values (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, values.title.trim(), values.description, values.area, values.priority, values.status, values.due_date, values.assignee_id, req.user.id)
    res.status(201).json({ task: getTask(id) })
  } catch (error) {
    return reportError(res, error)
  }
})

app.patch('/api/tasks/:id', requireUser, (req, res) => {
  const suppliedKeys = Object.keys(req.body || {})
  if (!suppliedKeys.length || suppliedKeys.some(key => !allowedTaskFields.has(key))) {
    return res.status(400).json({ error: 'The task update contains unsupported fields.' })
  }

  const existing = getTask(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Task not found.' })
  if (req.user.role !== 'admin') {
    if (existing.assignee_id !== req.user.id) return res.status(404).json({ error: 'Task not found.' })
    if (suppliedKeys.length !== 1 || suppliedKeys[0] !== 'status' || !statuses.has(req.body.status)) {
      return res.status(403).json({ error: 'Employees may only update the status of their assigned tasks.' })
    }
    const updated = db.prepare('update tasks set status = ?, updated_at = datetime(?) where id = ? and assignee_id = ?')
      .run(req.body.status, new Date().toISOString(), req.params.id, req.user.id)
    if (!updated.changes) return res.status(404).json({ error: 'Task not found.' })
    return res.json({ task: getTask(req.params.id) })
  }

  const values = { ...existing, ...req.body, assignee_id: req.body.assignee_id === '' ? null : (req.body.assignee_id ?? existing.assignee_id) }
  const validationError = validateTask(values)
  if (validationError) return res.status(400).json({ error: validationError })
  if (values.assignee_id && !db.prepare('select id from users where id = ? and approved = 1').get(values.assignee_id)) {
    return res.status(400).json({ error: 'The selected assignee does not exist or is awaiting approval.' })
  }
  const updated = db.prepare(`
    update tasks
    set title = ?, description = ?, area = ?, priority = ?, status = ?, due_date = ?, assignee_id = ?, updated_at = ?
    where id = ?
  `).run(values.title.trim(), values.description, values.area, values.priority, values.status, values.due_date, values.assignee_id, new Date().toISOString(), req.params.id)
  if (!updated.changes) return res.status(404).json({ error: 'Task not found.' })
  res.json({ task: getTask(req.params.id) })
})

app.delete('/api/tasks/:id', requireAdmin, (req, res) => {
  const result = db.prepare('delete from tasks where id = ?').run(req.params.id)
  if (!result.changes) return res.status(404).json({ error: 'Task not found.' })
  res.json({ ok: true })
})

app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }))

const buildDirectory = path.join(projectDirectory, 'dist')
if (serveStatic) {
  app.use(express.static(buildDirectory, { index: false }))
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(buildDirectory, 'index.html')))
}

app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError && 'body' in error) return res.status(400).json({ error: 'Request body must be valid JSON.' })
  return reportError(res, error)
})

app.listen(port, host, () => {
  console.log(`Nova Ops API listening on http://localhost:${port}`)
})
