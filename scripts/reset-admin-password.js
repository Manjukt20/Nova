import 'dotenv/config'
import { randomBytes } from 'node:crypto'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { db } from '../server/db.js'
import { hashPassword } from '../server/security.js'

function getArgument(name) {
  const index = process.argv.indexOf(name)
  return index < 0 ? '' : process.argv[index + 1] || ''
}

async function readHidden(prompt) {
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
    throw new Error('Run this command directly in an interactive terminal.')
  }

  stdout.write(prompt)
  stdin.setRawMode(true)
  stdin.resume()

  return new Promise((resolve, reject) => {
    let value = ''
    const finish = (error) => {
      stdin.removeListener('data', onData)
      stdin.setRawMode(false)
      stdout.write('\n')
      if (error) reject(error)
      else resolve(value)
    }
    const onData = buffer => {
      for (const character of buffer.toString('utf8')) {
        if (character === '\r' || character === '\n') return finish()
        if (character === '\u0003') return finish(new Error('Password reset cancelled.'))
        if (character === '\u0008' || character === '\u007f') value = value.slice(0, -1)
        else value += character
      }
    }
    stdin.on('data', onData)
  })
}

async function main() {
  try {
    const generatePassword = process.argv.includes('--generate')
    let email = getArgument('--email').trim().toLowerCase()
    if (!email) {
      const prompt = createInterface({ input: stdin, output: stdout })
      email = (await prompt.question('Administrator email: ')).trim().toLowerCase()
      prompt.close()
    }

    const user = db.prepare("select id from users where email = ? collate nocase and role = 'admin'").get(email)
    if (!user) throw new Error('No administrator account matches that email.')

    const password = generatePassword
      ? randomBytes(24).toString('base64url')
      : await readHidden('New password (minimum 12 characters): ')
    const confirmation = generatePassword
      ? password
      : await readHidden('Confirm new password: ')
    if (password.length < 12 || password.length > 200) {
      throw new Error('Password must be between 12 and 200 characters.')
    }
    if (password !== confirmation) throw new Error('Passwords do not match.')

    const { salt, hash } = await hashPassword(password)
    const resetPassword = db.transaction(() => {
      db.prepare('update users set password_salt = ?, password_hash = ?, must_change_password = ? where id = ?')
        .run(salt, hash, Number(generatePassword), user.id)
      db.prepare('delete from sessions where user_id = ?').run(user.id)
    })
    resetPassword()
    if (generatePassword) {
      stdout.write(`Temporary administrator password: ${password}\nChange it immediately after signing in.\n`)
    } else {
      stdout.write('Administrator password reset. Sign in with the new password.\n')
    }
  } finally {
    db.close()
  }
}

main().catch(error => {
  console.error(error.message)
  process.exitCode = 1
})
