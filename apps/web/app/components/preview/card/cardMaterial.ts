import type { InjectionKey, Ref } from 'vue'
import type { GlassColors } from './glass/edges'

export interface GlassProps {
  width?: number | string // 宽度，数字为 px，不传则由外部样式决定。
  height?: number | string // 高度，数字为 px，不传则由外部样式决定。
  radius?: number // 圆角半径，单位 px。
  moving?: boolean // 移动时只让边缘轮廓跟随尺寸，冻结取色，停止后重算并渐变。
  tintColor?: string // 整体染色，auto 为动态选取区域突出色。
  ringDepth?: number // 外侧旋转边缘的像素层数。
  ringReturn?: number // 内侧回正和羽化的像素层数。
  showOriginal?: boolean // 透视原图，否则透视简化图。
  passthrough?: boolean // 直接透出下层内容，不使用或更新 Layout 的背景裁切窗口。
  centerGlowColor?: string // 中心辉光颜色，变化时渐变切换。
  glow?: boolean // 根据区域明暗动态显示白色或黑色辉光。
  tint?: boolean // 是否显示整体染色。
  edgeTint?: boolean // 是否显示边缘透光。
  edgeTintColor?: string // 边缘透光颜色，auto 为动态突出色；传入颜色则跳过该效果的取色。
  outerGlow?: boolean // 是否显示外发光。
  outerGlowColor?: string // 外发光颜色，auto 为动态突出色；传入颜色则跳过该效果的取色。
  multithread?: boolean // 是否启用共享 Worker 计算。
  blur?: number // 背景模糊半径，单位 px，默认 0 不创建模糊层。
}

export interface CardProps extends GlassProps {
  showMode?: 0 | 1
  color?: string
}

export const glassDefaults = {
  radius: 12, moving: false, tintColor: 'auto', edgeTint: true, edgeTintColor: 'auto',
  outerGlow: true, outerGlowColor: 'auto', ringDepth: 4, ringReturn: 3,
  showOriginal: false, passthrough: false, glow: true, tint: true, multithread: true, blur: 0
} as const

export const CardStyleKey: InjectionKey<Readonly<Ref<{ showMode: 0 | 1, backgroundColor: string }>>> = Symbol('card-style')

// 只分析纯色，不读取背景图片，也不创建 Canvas 或 Worker。
export function blockColors(value: string): GlassColors | null {
  const hex = value.trim().match(/^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i)?.[1]
  let channels: number[]
  let alpha = 1
  if (hex) {
    const expanded = hex.length <= 4 ? [...hex].map(part => part + part).join('') : hex
    channels = [0, 2, 4].map(offset => parseInt(expanded.slice(offset, offset + 2), 16))
    if (expanded.length === 8) alpha = parseInt(expanded.slice(6, 8), 16) / 255
  } else {
    const rgb = value.trim().match(/^rgba?\(([^)]+)\)$/i)?.[1]
    if (!rgb) return null
    const parts = rgb.split(/[\s,/]+/).filter(Boolean)
    if (parts.length < 3 || parts.length > 4) return null
    channels = parts.slice(0, 3).map(part => parseFloat(part) * (part.endsWith('%') ? 2.55 : 1))
    if (parts[3]) alpha = parseFloat(parts[3]) / (parts[3].endsWith('%') ? 100 : 1)
  }
  if (![...channels, alpha].every(Number.isFinite)) return null
  alpha = Math.max(0, Math.min(1, alpha))
  const color = channels.map(channel => Math.round(Math.max(0, Math.min(255, channel)) * alpha + 255 * (1 - alpha))) as [number, number, number]
  const linear = color.map((channel) => {
    const value = channel / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  const light = 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]! > Math.sqrt(0.0525) - 0.05
  return { color, colorCss: `rgb(${color.join(' ')})`, tone: light ? 'light' : 'dark', textColor: light ? '#000' : '#fff', glowColor: light ? '#fff' : '#000' }
}
