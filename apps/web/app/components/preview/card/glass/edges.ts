// 组件用于通用卡片的边缘折射效果计算
import type { InjectionKey, Ref } from 'vue'
import type { SimplifiedImageData } from '../../../../utils/simplifyImage'
import type { BackgroundGeometry } from '../../../image/background'
import { toOklab } from '../../../../utils/simplifyImage'

export interface GlassFrame {
  left: number
  top: number
  width: number
  height: number
}

export interface GlassLayerContext {
  image: Readonly<Ref<string | undefined>>
  analysis: Readonly<Ref<SimplifiedImageData | undefined>>
  windows: Map<string, {
    frame: Ref<GlassFrame>
    radius: Readonly<Ref<number>>
    showOriginal: Readonly<Ref<boolean>>
    simplifiedOpacity?: Ref<number>
  }>
}

export const GlassLayerKey: InjectionKey<GlassLayerContext> = Symbol('glass-layer')

type Color = [number, number, number]
type AccentColors = { extremeTone: 'dark' | 'light' | null, accent: Color | null }
type Pixels = Pick<ImageData, 'width' | 'height' | 'data'>
const buffers = new WeakMap<Pixels, { width: number, height: number, classes: Int16Array, visited: Uint8Array, queue: Int32Array }>()
const chromas = new WeakMap<Color[], Float32Array>()

function analyzeAccentColors(pixels: Pixels, palette: Color[], frame: { width: number, height: number, radius: number, inset: number }): AccentColors | null {
  if (!palette.length || frame.width <= 0 || frame.height <= 0) return null
  const scale = Math.min(1, 128 / Math.max(frame.width, frame.height))
  const width = Math.max(1, Math.ceil(frame.width * scale))
  const height = Math.max(1, Math.ceil(frame.height * scale))
  const count = width * height
  let cached = buffers.get(pixels)
  if (!cached || cached.width !== width || cached.height !== height) {
    cached = { width, height, classes: new Int16Array(count), visited: new Uint8Array(count), queue: new Int32Array(count) }
    buffers.set(pixels, cached)
  }
  const { classes, visited, queue } = cached
  classes.fill(-1)
  visited.fill(0)
  const radius = Math.max(0, Math.min(frame.radius, frame.width / 2, frame.height / 2))
  const sx = pixels.width / (frame.width + frame.inset * 2)
  const sy = pixels.height / (frame.height + frame.inset * 2)
  let visible = 0
  let totalWeight = 0
  let blackWeight = 0
  let whiteWeight = 0
  for (let y = 0; y < height; y++) {
    const py = (y + 0.5) * frame.height / height
    for (let x = 0; x < width; x++) {
      const px = (x + 0.5) * frame.width / width
      const dx = Math.max(0, Math.abs(px - frame.width / 2) - (frame.width / 2 - radius))
      const dy = Math.max(0, Math.abs(py - frame.height / 2) - (frame.height / 2 - radius))
      if (dx * dx + dy * dy > radius * radius) continue
      const ix = Math.min(pixels.width - 1, Math.floor((px + frame.inset) * sx))
      const iy = Math.min(pixels.height - 1, Math.floor((py + frame.inset) * sy))
      const offset = (iy * pixels.width + ix) * 4
      const alpha = pixels.data[offset + 3]! / 255
      if (!alpha) continue
      totalWeight += alpha
      if (Math.max(pixels.data[offset]!, pixels.data[offset + 1]!, pixels.data[offset + 2]!) <= 12) blackWeight += alpha
      if (Math.min(pixels.data[offset]!, pixels.data[offset + 1]!, pixels.data[offset + 2]!) >= 245) whiteWeight += alpha
      let chosen = 0
      let minimum = Infinity
      for (let j = 0; j < palette.length; j++) {
        const color = palette[j]!
        const difference = (pixels.data[offset]! - color[0]) ** 2 + (pixels.data[offset + 1]! - color[1]) ** 2 + (pixels.data[offset + 2]! - color[2]) ** 2
        if (difference < minimum) {
          minimum = difference
          chosen = j
        }
      }
      classes[y * width + x] = chosen
      visible++
    }
  }
  if (!visible) return null
  const extremeTone = blackWeight / totalWeight >= 0.95 ? 'dark' : whiteWeight / totalWeight >= 0.95 ? 'light' : null
  let chroma = chromas.get(palette)
  if (!chroma) {
    chroma = Float32Array.from(palette, (color) => {
      const [, a, b] = toOklab(...color)
      return Math.hypot(a, b)
    })
    chromas.set(palette, chroma)
  }
  const largest = new Uint32Array(palette.length)
  for (let start = 0; start < count; start++) {
    const color = classes[start]!
    if (color < 0 || visited[start] || chroma[color]! < 0.08) continue
    let head = 0
    let tail = 1
    queue[0] = start
    visited[start] = 1
    const visit = (neighbor: number) => {
      if (!visited[neighbor] && classes[neighbor] === color) {
        visited[neighbor] = 1
        queue[tail++] = neighbor
      }
    }
    while (head < tail) {
      const index = queue[head++]!
      const x = index % width
      if (x) visit(index - 1)
      if (x + 1 < width) visit(index + 1)
      if (index >= width) visit(index - width)
      if (index + width < count) visit(index + width)
    }
    largest[color] = Math.max(largest[color]!, tail)
  }
  let chosen = -1
  let maximum = 0
  for (let i = 0; i < palette.length; i++) {
    if (!largest[i] || largest[i]! / visible < 0.005) continue
    const score = Math.sqrt(largest[i]! / visible) * chroma[i]! ** 2
    if (score > maximum) {
      maximum = score
      chosen = i
    }
  }
  return { extremeTone, accent: chosen < 0 ? null : palette[chosen]! }
}

export function readTintColor(color: string): Color | null {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return null
  context.fillStyle = '#000000'
  context.fillStyle = color
  const parsed = context.fillStyle
  context.fillStyle = '#ffffff'
  context.fillStyle = color
  if (context.fillStyle !== parsed) return null
  context.fillRect(0, 0, 1, 1)
  const pixels = context.getImageData(0, 0, 1, 1).data
  return pixels[3] ? [pixels[0]!, pixels[1]!, pixels[2]!] : null
}

export function glassTintStyle(color: Color | string, opacity: number) {
  if (typeof color === 'string') {
    return {
      background: `radial-gradient(ellipse at 50% 50%, color-mix(in srgb, ${color} 20%, transparent), color-mix(in srgb, ${color} 8%, transparent) 70%, transparent 100%)`,
      boxShadow: `inset 0 0 32px 8px color-mix(in srgb, ${color} 18%, transparent)`,
      opacity
    }
  }
  const channels = color.join(' ')
  return {
    background: `radial-gradient(ellipse at 50% 50%, rgb(${channels} / .2), rgb(${channels} / .08) 70%, transparent 100%)`,
    boxShadow: `inset 0 0 32px 8px rgb(${channels} / .18)`,
    opacity
  }
}

export interface GlassColors {
  color: [number, number, number] | null
  colorCss: string | null
  tone: 'light' | 'dark'
  textColor: '#000' | '#fff'
  glowColor: '#000' | '#fff'
}

export function analyzeGlassColors(data: SimplifiedImageData, image: BackgroundGeometry, frame: GlassFrame, radius: number, tintColor: string | [number, number, number] | null = 'auto'): GlassColors | null {
  if (image.width <= 0 || image.height <= 0 || frame.width <= 0 || frame.height <= 0) return null
  const left = image.centerX - image.width / 2
  const top = image.centerY - image.height / 2
  const r = Math.max(0, Math.min(radius, frame.width / 2, frame.height / 2))
  const scale = Math.min(1, 128 / Math.max(frame.width, frame.height))
  const width = Math.max(1, Math.ceil(frame.width * scale))
  const height = Math.max(1, Math.ceil(frame.height * scale))
  const customColor = Array.isArray(tintColor) ? tintColor : tintColor && tintColor.trim().toLowerCase() !== 'auto' ? readTintColor(tintColor) : null
  const pixels = tintColor !== null && !customColor ? { width, height, data: new Uint8ClampedArray(width * height * 4) } : null
  const bright = data.palette.map((color) => {
    const linear = color.map((value) => {
      const channel = value / 255
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]! > 0.179
  })
  let light = 0
  let dark = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const px = (x + 0.5) * frame.width / width
      const py = (y + 0.5) * frame.height / height
      const dx = Math.max(0, Math.abs(px - frame.width / 2) - (frame.width / 2 - r))
      const dy = Math.max(0, Math.abs(py - frame.height / 2) - (frame.height / 2 - r))
      if (dx * dx + dy * dy > r * r) continue
      const sx = Math.floor((frame.left + px - left) / image.width * data.width)
      const sy = Math.floor((frame.top + py - top) / image.height * data.height)
      if (sx < 0 || sy < 0 || sx >= data.width || sy >= data.height) continue
      const source = sy * data.width + sx
      const alpha = data.alpha?.[source] ?? 255
      if (!alpha) continue
      const label = data.labels[source]!
      const color = data.palette[label]!
      if (pixels) {
        const index = (y * width + x) * 4
        pixels.data.set(color, index)
        pixels.data[index + 3] = alpha
      }
      if (bright[label]) light += alpha / 255
      else dark += alpha / 255
    }
  }
  if (!light && !dark) return null
  const color = customColor ?? (pixels ? analyzeAccentColors(pixels, data.palette, { width: frame.width, height: frame.height, radius: r, inset: 0 })?.accent ?? null : null)
  return {
    color,
    colorCss: color ? `rgb(${color.join(' ')})` : null,
    tone: light >= dark ? 'light' : 'dark',
    textColor: light >= dark ? '#000' : '#fff',
    glowColor: light >= dark ? '#fff' : '#000'
  }
}

const paths = new WeakMap<HTMLCanvasElement | OffscreenCanvas, {
  key: string
  rings: number[][]
}>()

export function drawGlassEdges(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  data: SimplifiedImageData,
  image: BackgroundGeometry,
  frame: { left: number, top: number, width: number, height: number },
  radius: number,
  ringDepth = 3,
  ringReturn = 2
) {
  const width = Math.max(1, Math.round(frame.width))
  const height = Math.max(1, Math.round(frame.height))
  if (canvas.width !== width) canvas.width = width
  if (canvas.height !== height) canvas.height = height
  const context = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null
  if (!context) return
  const pixels = context.createImageData(width, height)
  if (image.width <= 0 || image.height <= 0) {
    paths.delete(canvas)
    context.putImageData(pixels, 0, 0)
    return pixels
  }
  const r = Math.max(0, Math.min(radius, width / 2, height / 2))
  const maximum = Math.floor(Math.min(width, height) / 2)
  const depth = Math.min(maximum, Math.max(0, Math.floor(ringDepth)))
  const returnDepth = depth ? Math.min(maximum - depth, Math.max(0, Math.floor(ringReturn))) : 0
  const key = `${width}:${height}:${r}:${depth}:${returnDepth}`
  let cached = paths.get(canvas)
  if (cached?.key !== key) {
    const rings = Array.from({ length: depth + returnDepth }, () => [] as number[])
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = Math.abs(x + 0.5 - width / 2) - (width / 2 - r)
        const dy = Math.abs(y + 0.5 - height / 2) - (height / 2 - r)
        const depth = r - Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) - Math.min(Math.max(dx, dy), 0)
        const layer = Math.floor(depth)
        if (layer >= 0 && layer < rings.length) rings[layer]!.push(y * width + x)
      }
    }
    const angle = (index: number) => Math.atan2(Math.floor(index / width) + 0.5 - height / 2, index % width + 0.5 - width / 2)
    for (const ring of rings) ring.sort((a, b) => angle(a) - angle(b))
    cached = { key, rings }
    paths.set(canvas, cached)
  }
  const left = image.centerX - image.width / 2
  const top = image.centerY - image.height / 2
  for (let layer = 0; layer < cached.rings.length; layer++) {
    const ring = cached.rings[layer]!
    const returning = layer >= depth ? (layer - depth + 1) / returnDepth : 0
    const strength = layer < depth ? layer + 1 : depth * (1 - returning)
    const opacity = 1 - returning
    if (!opacity) continue
    const shift = Math.round(2 * strength)
    for (let i = 0; i < ring.length; i++) {
      const source = ring[(i - shift % ring.length + ring.length) % ring.length]!
      const x = frame.left + (source % width + 0.5) * frame.width / width
      const y = frame.top + (Math.floor(source / width) + 0.5) * frame.height / height
      const sx = Math.floor((x - left) / image.width * data.width)
      const sy = Math.floor((y - top) / image.height * data.height)
      if (sx < 0 || sx >= data.width || sy < 0 || sy >= data.height) continue
      const index = sy * data.width + sx
      const color = data.palette[data.labels[index]!]!
      const target = ring[i]! * 4
      for (let channel = 0; channel < 3; channel++) pixels.data[target + channel] = color[channel]!
      pixels.data[target + 3] = Math.round(opacity * (data.alpha?.[index] ?? 255))
    }
  }
  context.putImageData(pixels, 0, 0)
  return pixels
}

export function fadeGlassEdges(canvas: HTMLCanvasElement, from: ImageData, to: ImageData) {
  const context = canvas.getContext('2d')!
  const previous = from.width === to.width && from.height === to.height ? from.data : undefined
  const pixels = context.createImageData(to.width, to.height)
  const edges: number[] = []
  for (let i = 0; i < to.data.length; i += 4) {
    if (previous?.[i + 3] || to.data[i + 3]) edges.push(i)
  }
  return (progress: number) => {
    for (const i of edges) {
      const before = (previous?.[i + 3] ?? 0) * (1 - progress)
      const after = to.data[i + 3]! * progress
      const alpha = before + after
      for (let channel = 0; channel < 3; channel++) {
        pixels.data[i + channel] = alpha ? ((previous?.[i + channel] ?? 0) * before + to.data[i + channel]! * after) / alpha : 0
      }
      pixels.data[i + 3] = alpha
    }
    context.putImageData(pixels, 0, 0)
    return pixels
  }
}

export function fitGlassEdges(target: HTMLCanvasElement, source: HTMLCanvasElement, width: number, height: number, inset: number) {
  width = Math.max(1, Math.round(width))
  height = Math.max(1, Math.round(height))
  if (target.width !== width) target.width = width
  if (target.height !== height) target.height = height
  const context = target.getContext('2d')
  if (!context || !source.width || !source.height) return
  context.clearRect(0, 0, width, height)
  context.imageSmoothingEnabled = false
  const from = Math.min(Math.max(1, inset), source.width / 2, source.height / 2)
  const to = Math.min(from, width / 2, height / 2)
  const sx = [0, from, source.width - from, source.width]
  const sy = [0, from, source.height - from, source.height]
  const dx = [0, to, width - to, width]
  const dy = [0, to, height - to, height]
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) {
      if (x === 1 && y === 1) continue
      const sw = sx[x + 1]! - sx[x]!
      const sh = sy[y + 1]! - sy[y]!
      const dw = dx[x + 1]! - dx[x]!
      const dh = dy[y + 1]! - dy[y]!
      if (sw > 0 && sh > 0 && dw > 0 && dh > 0)
        context.drawImage(source, sx[x]!, sy[y]!, sw, sh, dx[x]!, dy[y]!, dw, dh)
    }
  }
}

type Region = { start: number, length: number }
const tau = Math.PI * 2

export function randomProjectionRegions(): Region[] {
  const coverage = 0.3 + Math.random() * 0.3
  const first = coverage * (0.35 + Math.random() * 0.3)
  const start = Math.random()
  const gap = (1 - coverage) * (0.25 + Math.random() * 0.5)
  return [{ start, length: first }, { start: start + first + gap, length: coverage - first }]
}

function boundaryDistance(angle: number, width: number, height: number, radius: number, inset: number) {
  const hw = width / 2 - inset
  const hh = height / 2 - inset
  if (hw <= 0 || hh <= 0) return 0
  const r = Math.max(0, Math.min(radius - inset, hw, hh))
  const dx = Math.abs(Math.cos(angle))
  const dy = Math.abs(Math.sin(angle))
  const distance = Math.min(hw / Math.max(dx, 1e-12), hh / Math.max(dy, 1e-12))
  const cx = hw - r
  const cy = hh - r
  if (!r || distance * dx <= cx || distance * dy <= cy) return distance
  const dot = dx * cx + dy * cy
  return dot + Math.sqrt(Math.max(0, dot * dot - cx * cx - cy * cy + r * r))
}

function roundedPath(width: number, height: number, radius: number, inset = 0) {
  const w = width - inset * 2
  const h = height - inset * 2
  if (w <= 0 || h <= 0) return ''
  const r = Math.max(0, Math.min(radius - inset, w / 2, h / 2))
  const x = inset
  const y = inset
  return `M ${x + r} ${y} H ${x + w - r} A ${r} ${r} 0 0 1 ${x + w} ${y + r} V ${y + h - r} A ${r} ${r} 0 0 1 ${x + w - r} ${y + h} H ${x + r} A ${r} ${r} 0 0 1 ${x} ${y + h - r} V ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} Z`
}

export function buildRingProjection(width: number, height: number, radius: number, requestedDepth: number, regions: Region[]) {
  const depth = Math.min(requestedDepth, Math.floor(Math.min(width, height) / 2))
  if (width <= 0 || height <= 0 || depth <= 0) return null
  const r = Math.max(0, Math.min(radius, width / 2, height / 2))
  const samples = 360
  const areas = new Float64Array(samples + 1)
  const angleStep = tau / samples
  let previousOuter = boundaryDistance(-Math.PI / 2, width, height, r, 0)
  let previousInner = boundaryDistance(-Math.PI / 2, width, height, r, depth)
  for (let i = 1; i <= samples; i++) {
    const angle = -Math.PI / 2 + i * angleStep
    const outer = boundaryDistance(angle, width, height, r, 0)
    const inner = boundaryDistance(angle, width, height, r, depth)
    areas[i] = areas[i - 1]! + Math.max(0, (previousOuter * outer - previousInner * inner) * Math.sin(angleStep) / 2)
    previousOuter = outer
    previousInner = inner
  }
  const total = areas[samples]!
  if (!total) return null
  const angleAtArea = (fraction: number) => {
    const turn = Math.floor(fraction)
    const target = (fraction - turn) * total
    let low = 0
    let high = samples
    while (high - low > 1) {
      const middle = (low + high) >> 1
      if (areas[middle]! <= target) low = middle
      else high = middle
    }
    const span = areas[high]! - areas[low]!
    const offset = span ? (target - areas[low]!) / span : 0
    return -Math.PI / 2 + (low + offset) * angleStep + turn * tau
  }
  const point = (angle: number, inset: number) => {
    const distance = boundaryDistance(angle, width, height, r, inset)
    return { x: width / 2 + Math.cos(angle) * distance, y: height / 2 + Math.sin(angle) * distance }
  }
  const patches = regions.flatMap(region => Array.from({ length: 24 }, (_, i) => {
    const start = angleAtArea(region.start + region.length * i / 24)
    const end = angleAtArea(region.start + region.length * (i + 1) / 24)
    const count = Math.max(1, Math.ceil((end - start) / angleStep))
    let path = `M ${width / 2} ${height / 2}`
    for (let j = 0; j <= count; j++) {
      const p = point(start + (end - start) * j / count, 0)
      path += ` L ${p.x} ${p.y}`
    }
    return {
      path: `${path} Z`,
      start: point(start, depth / 2),
      end: point(end, depth / 2),
      startOpacity: Math.sin(Math.PI * i / 24) ** 2 * 0.85,
      endOpacity: Math.sin(Math.PI * (i + 1) / 24) ** 2 * 0.85
    }
  }))
  const count = Math.max(2, Math.min(24, Math.ceil(depth)))
  const bands = Array.from({ length: count }, (_, i) => {
    const inset = depth * (i + 0.5) / count
    return {
      inset,
      width: width - inset * 2,
      height: height - inset * 2,
      radius: Math.max(0, r - inset),
      strokeWidth: depth / count + 0.1,
      opacity: (1 - (i + 0.5) / count) ** 1.8
    }
  })
  return { width, height, patches, bands, clip: roundedPath(width, height, r) + roundedPath(width, height, r, depth) }
}

export type RingProjectionData = NonNullable<ReturnType<typeof buildRingProjection>>

export interface GlassEffectOptions {
  geometry: BackgroundGeometry
  frame: GlassFrame
  radius: number
  depth: number
  returnDepth: number
  tintColor?: [number, number, number]
  regions: ReturnType<typeof randomProjectionRegions>
  edgesOnly?: boolean
  accent?: boolean
  projection?: boolean
}

export function computeGlassEffects(canvas: HTMLCanvasElement | OffscreenCanvas, data: SimplifiedImageData, options: GlassEffectOptions) {
  const { geometry, frame, radius, depth, returnDepth, regions, tintColor } = options
  const colors = options.edgesOnly ? null : analyzeGlassColors(data, geometry, frame, radius, options.accent === false ? null : tintColor)
  const pixels = drawGlassEdges(canvas, data, geometry, frame, radius, depth, returnDepth)
  if (!pixels) throw new Error('无法创建玻璃边缘画布')
  const projection = options.edgesOnly || options.projection === false ? null : buildRingProjection(frame.width, frame.height, radius, depth ? depth + returnDepth : 0, regions)
  return { colors, pixels, projection }
}

export type GlassEffects = ReturnType<typeof computeGlassEffects>
export type GlassWorkerMessage
  = | { type: 'image', id: number, data: SimplifiedImageData }
    | { type: 'delete-image', id: number }
    | { type: 'dispose', client: number }
    | { type: 'compute', client: number, request: number, image: number, options: GlassEffectOptions }

export type GlassWorkerReply = { client: number, request: number } & (
  | { result: GlassEffects }
  | { error: string }
)
