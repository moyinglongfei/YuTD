import process from 'node:process'
import { existsSync, mkdirSync, writeFileSync, statSync, unlinkSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { PrismaClient } from '../../generated/prisma/client'
import { getDatabaseFile, getDatabaseUrl, serverDirectory } from './database'
import 'dotenv/config'

const connectionString = getDatabaseUrl()
const databaseFile = getDatabaseFile(connectionString)

// 仅为不存在的新数据库建表，已有文件不执行结构同步或重置。
if (databaseFile && !existsSync(databaseFile)) {
  mkdirSync(dirname(databaseFile), { recursive: true })
  writeFileSync(databaseFile, '', { flag: 'wx' })
  const initialized = Bun.spawnSync([
    process.execPath,
    fileURLToPath(new URL('../../node_modules/prisma/build/index.js', import.meta.url)),
    'db', 'push',
  ], {
    cwd: serverDirectory,
    env: { ...process.env, DATABASE_URL: connectionString },
    stdout: 'inherit',
    stderr: 'inherit',
  })
  if (initialized.exitCode !== 0) {
    if (statSync(databaseFile).size === 0) unlinkSync(databaseFile)
    throw new Error('首次数据库初始化失败，请检查上方 Prisma 错误后重新启动')
  }
}

const adapter = new PrismaLibSql({ url: connectionString })
const prisma = new PrismaClient({ adapter })

export { prisma }
