export const appFontOptions = [
  { value: 'system-ui', label: '系统默认' },
  { value: 'browser-default', label: '浏览器默认' },
  { value: 'sans-serif', label: '浏览器无衬线体' },
  { value: 'serif', label: '浏览器衬线体' },
  { value: 'monospace', label: '浏览器等宽体' },
  { value: 'Segoe UI', label: 'Segoe UI（Windows／Edge 常用）' },
  { value: 'Segoe UI Variable', label: 'Segoe UI Variable' },
  { value: 'Microsoft YaHei', label: '微软雅黑' },
  { value: 'SimSun', label: '宋体' },
  { value: 'KaiTi', label: '楷体' },
  { value: 'FangSong', label: '仿宋' },
  { value: 'DengXian', label: '等线' },
  { value: 'PingFang SC', label: '苹方' },
  { value: 'Noto Sans SC', label: '思源黑体' },
  { value: 'Noto Serif SC', label: '思源宋体' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Times New Roman', label: 'Times New Roman' },
  { value: 'Verdana', label: 'Verdana' },
  { value: 'Tahoma', label: 'Tahoma' },
  { value: 'Courier New', label: 'Courier New' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Consolas', label: 'Consolas' },
  { value: 'Cascadia Code', label: 'Cascadia Code' },
  { value: 'JetBrains Mono', label: 'JetBrains Mono' }
]

export function getAppFontStack(family: string) {
  const value = family.trim() || 'system-ui'
  if (value === 'browser-default')
    return 'initial'
  if (['sans-serif', 'serif', 'monospace', 'cursive', 'fantasy'].includes(value))
    return value
  if (value === 'system-ui')
    return 'system-ui, -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif'
  return JSON.stringify(value) + ', system-ui, "Microsoft YaHei", "PingFang SC", sans-serif'
}

export async function readLocalFontFamilies() {
  const browser = window as Window & { queryLocalFonts?: () => Promise<{ family: string }[]> }
  if (!browser.queryLocalFonts)
    throw new Error('当前浏览器无法列出本机字体，可以直接输入已安装字体的名称。')
  const fonts = await browser.queryLocalFonts()
  const families = new Map<string, string>()
  for (const font of fonts) {
    const family = font.family.trim()
    if (family && !families.has(family.toLocaleLowerCase()))
      families.set(family.toLocaleLowerCase(), family)
  }
  return [...families.values()].sort((a, b) => a.localeCompare(b))
}
