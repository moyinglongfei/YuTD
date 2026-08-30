import type { ConfigModelType } from '@/modules/config/model'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { Value } from '@sinclair/typebox/value'
import YAML from 'yaml'
import { ConfigModel } from '@/modules/config/model'

const CONFIG_PATH = path.resolve(process.cwd(), './config.yaml')
const CONFIG_EXAMPLE_PATH = path.resolve(process.cwd(), './config.example.yaml')

export function loadConfig(): ConfigModelType['config'] {
  if (!fs.existsSync(CONFIG_PATH)) {
    if (!fs.existsSync(CONFIG_EXAMPLE_PATH))
      throw new Error(`缺少配置文件和配置模板：${CONFIG_PATH}、${CONFIG_EXAMPLE_PATH}`)

    fs.copyFileSync(CONFIG_EXAMPLE_PATH, CONFIG_PATH)
  }

  const text = fs.readFileSync(CONFIG_PATH, 'utf8')
  const doc = YAML.parseDocument(text)
  let data: any

  try {
    data = doc.toJSON()
  }
  catch (error) {
    throw new Error(`YAML 语法错误，请检查缩进或格式：${(error as Error).message}`)
  }

  if (!data.auth.secret) {
    const secret = crypto.randomBytes(32).toString('hex')
    doc.setIn(['auth', 'secret'], secret)
    fs.writeFileSync(CONFIG_PATH, doc.toString(), 'utf8')
    data.auth.secret = secret
  }

  if (!Value.Check(ConfigModel.config, data)) {
    const errors = [...Value.Errors(ConfigModel.config, data)]
    throw new Error(`配置文件格式不正确：${CONFIG_PATH}
      具体的校验错误：${errors}`)
  }

  return data as ConfigModelType['config']
}

// 判断一个值是否可以继续向下遍历
function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
}

// 写入末端值
function applyPatch(
  doc: YAML.Document,
  patch: Record<string, unknown>,
  path: string[] = [],
) {
  Object.entries(patch).forEach(([key, value]) => {
    if (value === undefined)
      return

    const currentPath = [...path, key]

    if (isPlainObject(value)) {
      applyPatch(doc, value, currentPath)
      return
    }

    doc.setIn(currentPath, value)
  })
}

export function patchConfig(
  patch: ConfigModelType['newConfig'],
): ConfigModelType['config'] {
  const text = fs.readFileSync(CONFIG_PATH, 'utf8')
  const doc = YAML.parseDocument(text)

  applyPatch(
    doc,
    patch as Record<string, unknown>,
  )

  const config = doc.toJSON()

  if (!Value.Check(ConfigModel.config, config)) {
    const errors = [
      ...Value.Errors(ConfigModel.config, config),
    ]

    throw new Error(
      `合并后的配置格式不正确：${errors}`,
    )
  }

  fs.writeFileSync(
    CONFIG_PATH,
    doc.toString(),
    'utf8',
  )

  return config as ConfigModelType['config']
}
