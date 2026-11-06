/// <reference path="../assets.d.ts" />
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs'
import { dirname } from 'node:path'
import { Database } from 'bun:sqlite'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { PrismaClient } from '../../generated/prisma/client'
import initialSchema from '../../generated/prisma/initialize.sql' with { type: 'text' }
import { getDatabaseFile, getDatabaseUrl } from './database'
import 'dotenv/config'

const connectionString = getDatabaseUrl()
const databaseFile = getDatabaseFile(connectionString)

// 仅为不存在的新数据库建表，已有文件不执行结构同步或重置。
if (databaseFile && !existsSync(databaseFile)) {
  mkdirSync(dirname(databaseFile), { recursive: true })
  writeFileSync(databaseFile, '', { flag: 'wx' })
  let database: Database | undefined
  try {
    // SQL 由 Prisma schema 生成并随程序打包，首次建库不依赖外部 CLI。
    database = new Database(databaseFile)
    database.transaction(() => database!.exec(initialSchema))()
  } catch (cause) {
    database?.close()
    database = undefined
    unlinkSync(databaseFile)
    throw new Error('首次数据库初始化失败', { cause })
  } finally {
    database?.close()
  }
}

const adapter = new PrismaLibSql({ url: connectionString })
const prisma = new PrismaClient({ adapter })

export { prisma }
