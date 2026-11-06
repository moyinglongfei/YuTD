import process from 'node:process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { serverDirectory } from './paths'

export { serverDirectory }

export function getDatabaseUrl() {
  const value = process.env.DATABASE_URL?.trim() || 'file:./dev.db'
  const file = getDatabaseFile(value)
  return file ? `file:${file.replaceAll('\\', '/')}` : value
}

export function getDatabaseFile(value: string) {
  if (!value.startsWith('file:')) return null
  return value.startsWith('file://')
    ? fileURLToPath(value)
    : resolve(serverDirectory, value.slice(5))
}
