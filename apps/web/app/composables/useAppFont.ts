export interface AppFontOption {
  id: string
  label: string
  stack: string
}

const STORAGE_KEY = 'yutd-font-family'

export const appFontOptions: AppFontOption[] = [
  {
    id: 'system',
    label: '系统默认',
    stack: 'system-ui, -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif'
  },
  {
    id: 'sans',
    label: '黑体（无衬线）',
    stack: '"Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif'
  },
  {
    id: 'serif',
    label: '宋体（衬线）',
    stack: '"SimSun", "Songti SC", "Noto Serif SC", serif'
  },
  {
    id: 'kai',
    label: '楷体',
    stack: '"KaiTi", "Kaiti SC", "STKaiti", serif'
  },
  {
    id: 'mono',
    label: '等宽字体',
    stack: '"Cascadia Code", Consolas, "JetBrains Mono", monospace'
  }
]

function findOptionById(id: string | null) {
  return appFontOptions.find(option => option.id === id)
}

export function applyAppFont(id: string) {
  const option = findOptionById(id)
  if (!option)
    return

  if (import.meta.client) {
    localStorage.setItem(STORAGE_KEY, id)
    document.documentElement.style.setProperty('--app-font-family', option.stack)
  }
}

export function initAppFont() {
  if (!import.meta.client)
    return

  const option = findOptionById(localStorage.getItem(STORAGE_KEY))
  if (!option)
    return

  document.documentElement.style.setProperty('--app-font-family', option.stack)
}
