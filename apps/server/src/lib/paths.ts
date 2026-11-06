import process from 'node:process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// 编译后的模块位于 Bun 虚拟文件系统，运行数据应保存在可执行文件旁边。
const standalone = typeof Bun !== 'undefined' && Bun.isStandaloneExecutable
export const serverDirectory = standalone
  ? dirname(process.execPath)
  : fileURLToPath(new URL('../../', import.meta.url))
export const configDirectory = standalone ? serverDirectory : resolve(serverDirectory, '../..')
