export type EditValue = string | number | boolean
export type EditValues = Record<string, EditValue>
export interface EditField {
  key: string
  label: string
  defaultValue: EditValue
  type?: 'number' | 'integer' | 'string' | 'boolean'
  min?: number
  max?: number
  step?: number
  description?: string
}

export function editFieldType(field: EditField): NonNullable<EditField['type']> {
  return field.type ?? (typeof field.defaultValue as 'number' | 'string' | 'boolean')
}

export function editFieldStep(field: EditField) {
  return field.step ?? (editFieldType(field) === 'integer' ? 1 : 0.1)
}

export function editFieldValues(fields: EditField[], values: EditValues = {}): EditValues {
  return Object.fromEntries(fields.map(field => [field.key, values[field.key] ?? field.defaultValue]))
}

export function editFieldErrors(fields: EditField[], values: EditValues): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const field of fields) {
    const value = values[field.key]
    const type = editFieldType(field)
    if (type === 'number' || type === 'integer') {
      if (typeof value !== 'number' || !Number.isFinite(value)) errors[field.key] = '请输入有效数值'
      else if (type === 'integer' && !Number.isInteger(value)) errors[field.key] = '请输入整数'
      else if (field.min !== undefined && value < field.min) errors[field.key] = `不能小于 ${field.min}`
      else if (field.max !== undefined && value > field.max) errors[field.key] = `不能大于 ${field.max}`
      else if (field.step !== undefined) {
        const steps = (value - (field.min ?? 0)) / field.step
        if (Math.abs(steps - Math.round(steps)) > 1e-7) errors[field.key] = `请按 ${field.step} 的步长调整`
      }
    } else if (typeof value !== type) {
      errors[field.key] = type === 'boolean' ? '请选择开关状态' : '请输入文字'
    }
  }
  return errors
}
