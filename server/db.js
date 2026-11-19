import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'

const serverDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectDirectory = path.dirname(serverDirectory)
const databasePath = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.join(projectDirectory, 'data', 'ironix.sqlite')

fs.mkdirSync(path.dirname(databasePath), { recursive: true })

export const db = new Database(databasePath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')
db.exec(`
  create table if not exists users (
    id text primary key,
    email text not null unique collate nocase,
    full_name text not null,
    role text not null check (role in ('admin', 'employee')),
    password_hash text not null,
    password_salt text not null,
    must_change_password integer not null default 0,
    approved integer not null default 1 check (approved in (0, 1)),
    created_at text not null default (datetime('now'))
  );

  create table if not exists sessions (
    token_hash text primary key,
    user_id text not null references users(id) on delete cascade,
    expires_at integer not null,
    created_at text not null default (datetime('now'))
  );

  create table if not exists tasks (
    id text primary key,
    title text not null,
    description text not null default '',
    area text not null,
    priority text not null check (priority in ('low', 'medium', 'high')),
    status text not null check (status in ('todo', 'in_progress', 'review', 'done')),
    due_date text,
    assignee_id text references users(id) on delete set null,
    created_by text not null references users(id),
    created_at text not null default (datetime('now')),
    updated_at text not null default (datetime('now'))
  );

  create index if not exists sessions_user_id_idx on sessions(user_id);
  create index if not exists tasks_assignee_due_date_idx on tasks(assignee_id, due_date);
  create index if not exists tasks_due_date_idx on tasks(due_date);
`)
if (!db.pragma('table_info(users)').some(column => column.name === 'approved')) {
  db.exec('alter table users add column approved integer not null default 1 check (approved in (0, 1))')
}
db.prepare('delete from sessions where expires_at <= ?').run(Date.now())
