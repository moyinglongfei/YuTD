import type { ConfigModelType } from '#backend/modules/config/model'
import crypto from 'node:crypto'
import process from 'node:process'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Value } from '@sinclair/typebox/value'
import YAML from 'yaml'
import { ConfigModel } from '#backend/modules/config/model'

const CONFIG_PATH = fileURLToPath(new URL('../../../../config.yaml', import.meta.url))
const CONFIG_EXAMPLE_PATH = fileURLToPath(new URL('../../../../config.example.yaml', import.meta.url))
const LEGACY_CONFIG_PATH = fileURLToPath(new URL('../../config.yaml', import.meta.url))

function saveConfig(text: string) {
  const temporary = `${CONFIG_PATH}.${process.pid}.tmp`
  fs.writeFileSync(temporary, text, 'utf8')
  fs.renameSync(temporary, CONFIG_PATH)
}

export function loadConfig(): ConfigModelType['config'] {
  if (!fs.existsSync(CONFIG_PATH)) {
    if (fs.existsSync(LEGACY_CONFIG_PATH))
      fs.renameSync(LEGACY_CONFIG_PATH, CONFIG_PATH)
    else if (!fs.existsSync(CONFIG_EXAMPLE_PATH))
      throw new Error(`缺少配置文件和配置模板：${CONFIG_PATH}、${CONFIG_EXAMPLE_PATH}`)
    else
      saveConfig(fs.readFileSync(CONFIG_EXAMPLE_PATH, 'utf8'))
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

  let changed = false
  // 旧配置保留后端和鉴权信息，只补充前端监听设置。
  for (const [key, value] of Object.entries({ webHost: 'localhost', webPort: 3001 })) {
    if (data?.system && data.system[key] === undefined) {
      data.system[key] = value
      doc.setIn(['system', key], value)
      changed = true
    }
  }
  if (data?.auth && !data.auth.secret) {
    const secret = crypto.randomBytes(32).toString('hex')
    doc.setIn(['auth', 'secret'], secret)
    data.auth.secret = secret
    changed = true
  }

  if (!Value.Check(ConfigModel.config, data)) {
    const errors = [...Value.Errors(ConfigModel.config, data)]
    throw new Error(`配置文件格式不正确：${CONFIG_PATH}
      具体的校验错误：${errors}`)
  }

  if (changed)
    saveConfig(doc.toString())

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

  saveConfig(doc.toString())

  return config as ConfigModelType['config']
}
