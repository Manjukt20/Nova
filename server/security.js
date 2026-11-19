import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)
export const SESSION_COOKIE = 'ironix_session'
export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000

export function newId() {
  return randomUUID()
}

export function hashSessionToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 })
  return { salt, hash: hash.toString('hex') }
}

export async function verifyPassword(password, salt, storedHash) {
  const actual = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 })
  const expected = Buffer.from(storedHash, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export function constantTimeStringEqual(first, second) {
  const left = Buffer.from(first)
  const right = Buffer.from(second)
  return left.length === right.length && timingSafeEqual(left, right)
}
