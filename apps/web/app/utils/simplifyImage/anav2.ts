/** AnaV2: 颜色预归并 + 连通区域权重 + 高显著性重点色 + 细线保护平滑。 */
export type Color = [number, number, number]

export interface ColorAnalysis {
  width: number
  height: number
  palette: Color[]
  labels: Uint8Array
  /** 逐像素透明度；省略时全部不透明。 */
  alpha?: Uint8Array
}

export interface AnaV2Options {
  /** 自动按有效色群分布选择 8~26 色；数字表示手动指定上限。 */
  colors?: number | 'auto'
  centerWeight?: number
  specialWeight?: number
  anchorMinPercent?: number
  mergeRange?: number
  contourSteps?: number
  /** 越大越奖励同一色群在画面中形成的大块连续区域。1 表示不奖励。 */
  connectedPower?: number
  /** 连接性评分的保底系数（0~1），避免零散但重要的颜色被彻底排除。 */
  scatteredFloor?: number
  /** 用于选色时的面积指数；越小越给小面积颜色机会。 */
  areaPower?: number
  /** 强制优先选择的显著色候选上限。不存在合格的显著色时不会占名额。 */
  accentSlots?: number
  /** 醒目色连通块的最小面积（像素）。 */
  accentMinArea?: number
  /** 边界色差奖励强度，越大越保护局部对比强烈的颜色。 */
  edgeWeight?: number
  /** 细线保护强度：0=关闭，1=锁定检测到的细线（默认 1）。 */
  lineProtection?: number
  /** 判断细线局部稀疏程度的窗口宽度，必须为奇数，默认 7。 */
  lineWindow?: number
  /** 原图中细线对周围的最小 OKLab 感知色差（非平方），默认 0.075。 */
  lineContrast?: number
  /** 细线颜色在局部窗口内的最大面积比例，默认 0.38。 */
  lineMaxDensity?: number
  /** 平滑时的色彩引导强度：越小越不易跨越原图颜色边界，默认 1。 */
  edgeSigma?: number
}

export const defaultAnalysisOptions: Required<AnaV2Options> = {
  colors: 'auto',
  centerWeight: 4,
  specialWeight: 8,
  anchorMinPercent: 2,
  mergeRange: 5,
  contourSteps: 1,
  connectedPower: 1.55,
  scatteredFloor: 0.12,
  areaPower: 0.72,
  accentSlots: 4,
  accentMinArea: 6,
  edgeWeight: 4,
  lineProtection: 1,
  lineWindow: 7,
  lineContrast: 0.075,
  lineMaxDensity: 0.38,
  edgeSigma: 1
}
export const ANALYSIS_MAX_SIZE = 1024

const BIN_BITS = 5
const BIN_SHIFT = 8 - BIN_BITS
const BIN_COUNT = 1 << (3 * BIN_BITS)
const EPS = 1e-9
const linear = Float32Array.from({ length: 256 }, (_, value) => {
  const channel = value / 255
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
})
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const asByte = (v: number) => Math.round(clamp(v, 0, 255))
const binKey = (r: number, g: number, b: number) =>
  (r >> BIN_SHIFT << (2 * BIN_BITS)) | (g >> BIN_SHIFT << BIN_BITS) | (b >> BIN_SHIFT)

export function toOklab(red: number, green: number, blue: number): Color {
  const r = linear[asByte(red)]!
  const g = linear[asByte(green)]!
  const b = linear[asByte(blue)]!
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  ]
}

// 与原 AnaV2 一致：增强 chroma 维度以区分淡彩和灰白。
const distance = (a: Color, b: Color) =>
  (a[0] - b[0]) ** 2 + 4 * (a[1] - b[1]) ** 2 + 4 * (a[2] - b[2]) ** 2

interface Bin {
  key: number
  area: number
  weightedArea: number
  redSum: number
  greenSum: number
  blueSum: number
  lab: Color
}
interface Group {
  id: number
  area: number
  weightedArea: number
  redSum: number
  greenSum: number
  blueSum: number
  lab: Color
  rgb: Color
  /** 各连通块面积的 p 次幂之和。 */
  areaPowerSum: number
  maxComponent: number
  /** 具备连续面积的醒目色局部边界对比奖励。 */
  strongestEdge: number
  score: number
  accentScore: number
}

function makeBin(key: number, area: number, weightedArea: number, r: number, g: number, b: number): Bin {
  const rgb: Color = [r / area, g / area, b / area]
  return { key, area, weightedArea, redSum: r, greenSum: g, blueSum: b, lab: toOklab(...rgb) }
}

function updateGroup(group: Group, bin: Bin) {
  group.area += bin.area
  group.weightedArea += bin.weightedArea
  group.redSum += bin.redSum
  group.greenSum += bin.greenSum
  group.blueSum += bin.blueSum
  group.rgb = [group.redSum / group.area, group.greenSum / group.area, group.blueSum / group.area]
  group.lab = toOklab(...group.rgb)
}

function createGroups(bins: Bin[], mergeRange: number): { groups: Group[], binGroups: Uint16Array } {
  // 将相近颜色 *先* 归并为色群；不依赖精确 RGB 的出现频率。
  // 按面积排序优先建立稳定的色群中心，合并后中心始终受限于当前平均色距。
  const groups: Group[] = []
  const binGroups = new Uint16Array(BIN_COUNT)
  const threshold = (Math.max(0, mergeRange) / 100) ** 2
  bins.sort((a, b) => b.area - a.area || a.key - b.key)
  for (const bin of bins) {
    let closest = -1
    let closestDistance = threshold + EPS
    for (const group of groups) {
      const d = distance(bin.lab, group.lab)
      if (d <= threshold && d < closestDistance) {
        closestDistance = d
        closest = group.id
      }
    }
    if (closest < 0) {
      const rgb: Color = [bin.redSum / bin.area, bin.greenSum / bin.area, bin.blueSum / bin.area]
      closest = groups.length
      groups.push({
        id: closest,
        area: bin.area,
        weightedArea: bin.weightedArea,
        redSum: bin.redSum,
        greenSum: bin.greenSum,
        blueSum: bin.blueSum,
        rgb,
        lab: bin.lab,
        areaPowerSum: 0,
        maxComponent: 0,
        strongestEdge: 0,
        score: 0,
        accentScore: 0
      })
    } else {
      updateGroup(groups[closest]!, bin)
    }
    binGroups[bin.key] = closest
  }
  return { groups, binGroups }
}

function hueStrength(lab: Color): number {
  const angle = ((Math.atan2(lab[2], lab[1]) * 180 / Math.PI) + 360) % 360
  // OKLCh hue：红≈25，黄≈100，蓝≈260，紫≈310。
  const huePeak = (target: number, spread: number): number => {
    const delta = Math.abs(angle - target)
    const degrees = Math.min(delta, 360 - delta)
    return Math.exp(-0.5 * (degrees / spread) ** 2)
  }
  return Math.max(
    huePeak(25, 28),
    huePeak(100, 25),
    huePeak(260, 35),
    huePeak(315, 27)
  )
}

function colorVividness(lab: Color): number {
  const chroma = Math.hypot(lab[1], lab[2])
  const saturation = clamp((chroma - 0.022) / 0.115, 0, 1)
  // 明度接近纯白时，饱和度奖励自然趋弱；中深色仍可获得奖励。
  const lightnessGate = 1 - 0.28 * clamp((lab[0] - 0.85) / 0.15, 0, 1)
  return saturation ** 1.15 * lightnessGate
}

/** 统计每个色群由哪些连续区域构成，计算局部边缘对比。 */
function measureComponents(
  groups: Group[], labels: Int32Array, rgba: Uint8ClampedArray,
  width: number, height: number, exponent: number, minArea: number
) {
  const size = width * height
  const visited = new Uint8Array(size)
  const queue = new Int32Array(size)
  for (let start = 0; start < size; start++) {
    if (visited[start] || labels[start]! < 0) continue
    const gid = labels[start]!
    const group = groups[gid]!
    let front = 0
    let back = 1
    let area = 0
    let edgeSum = 0
    let edgeCount = 0
    queue[0] = start
    visited[start] = 1
    while (front < back) {
      const pos = queue[front++]!
      const x = pos % width
      const y = (pos / width) | 0
      area += rgba[pos * 4 + 3]! / 255
      // 手动四邻接以避免为每个像素构造临时数组。
      const inspect = (next: number) => {
        const neighborGroup = labels[next]!
        if (neighborGroup < 0) return
        if (neighborGroup === gid) {
          if (!visited[next]) {
            visited[next] = 1
            queue[back++] = next
          }
        } else {
          edgeSum += Math.sqrt(distance(group.lab, groups[neighborGroup]!.lab))
          edgeCount++
        }
      }
      if (x > 0) inspect(pos - 1)
      if (x + 1 < width) inspect(pos + 1)
      if (y > 0) inspect(pos - width)
      if (y + 1 < height) inspect(pos + width)
    }
    group.areaPowerSum += area ** exponent
    group.maxComponent = Math.max(group.maxComponent, area)
    if (area >= minArea && edgeCount > 0) {
      const contrast = clamp(edgeSum / edgeCount / 0.16, 0, 1.5)
      // 小连通块也能有较高边界奖励，但孤立噪点不参加。
      const localScore = Math.sqrt(area) * contrast
      group.strongestEdge = Math.max(group.strongestEdge, localScore)
    }
  }
}

/**
 * 保存原图每个像素的 OKLab 向量；不要用调色板值判断原图是否存在真实轮廓。
 * 只在启用平滑时构造，减少关闭平滑时的开销。
 */
function createPixelLabs(rgba: Uint8ClampedArray, size: number): Float32Array {
  const labs = new Float32Array(size * 3)
  for (let i = 0; i < size; i++) {
    const offset = i * 4
    if (!rgba[offset + 3]) continue
    const lab = toOklab(rgba[offset]!, rgba[offset + 1]!, rgba[offset + 2]!)
    const at = i * 3
    labs[at] = lab[0]
    labs[at + 1] = lab[1]
    labs[at + 2] = lab[2]
  }
  return labs
}

/** 与 distance() 完全一致的加权、平方 OKLab 色距。 */
function pixelDistance(labs: Float32Array, i: number, j: number): number {
  const a = i * 3
  const b = j * 3
  const dl = labs[a]! - labs[b]!
  const da = labs[a + 1]! - labs[b + 1]!
  const db = labs[a + 2]! - labs[b + 2]!
  return dl * dl + 4 * (da * da + db * db)
}

function normalizedLineWindow(value: number): number {
  const v = Math.max(3, Math.min(15, Math.round(value)))
  return v % 2 === 0 ? v + (v < 15 ? 1 : -1) : v
}

/**
 * 判断细线而不是孤立噪点：
 *  1. 当前标签在 7×7 附近较少见；
 *  2. 3×3 中存在同色连续像素，但不能是大块内部；
 *  3. 原图像素与身边其它标签的原图像素确实存在颜色反差。
 *  4. 单端点只能在连接到已确认细线时获得保护。
 * 掩码是以「平滑前的标签」为基础的，避免多轮平滑产生反馈偏差。
 */
function detectLineMask(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  labels: Uint8Array,
  labs: Float32Array,
  options: Pick<Required<AnaV2Options>, 'lineWindow' | 'lineContrast' | 'lineMaxDensity'>
): Uint8Array {
  const mask = new Uint8Array(width * height)
  if (width < 3 || height < 3) return mask
  const radius = (normalizedLineWindow(options.lineWindow) - 1) >> 1
  const contrastSquared = Math.max(0, options.lineContrast) ** 2
  const densityLimit = clamp(options.lineMaxDensity, 0, 1)
  const alpha = (index: number): boolean => rgba[index * 4 + 3]! >= 128

  // 内层以 3×3 判断线的宽度和局部颜色反差。
  // 7×7 仅对稀疏的候选像素执行，避免对每个像素都重复扫描 49 次。
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const pos = y * width + x
      if (!alpha(pos)) continue
      const label = labels[pos]!
      let same = 0
      let different = 0
      let neighborDifference = 0
      let pairOpposite = false
      // 相反方向的同色邻居通常代表一条穿过当前位置的细线。
      const pairs: [number, number][] = [
        [pos - 1, pos + 1],
        [pos - width, pos + width],
        [pos - width - 1, pos + width + 1],
        [pos - width + 1, pos + width - 1]
      ]
      for (const [a, b] of pairs) {
        if (alpha(a) && alpha(b) && labels[a] === label && labels[b] === label) {
          pairOpposite = true
          break
        }
      }
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue
          const other = pos + dy * width + dx
          if (!alpha(other)) continue
          if (labels[other] === label) {
            same++
          } else {
            different++
            neighborDifference += pixelDistance(labs, pos, other)
          }
        }
      }
      if (same === 0 || same > 5 || different < 2) continue
      // 使用原图像素对邻域其它颜色的均方根色距，不依赖量化后调色板。
      if (neighborDifference / different < contrastSquared) continue

      let own = 0
      let visible = 0
      for (let dy = -radius; dy <= radius; dy++) {
        const yy = y + dy
        if (yy < 0 || yy >= height) continue
        for (let dx = -radius; dx <= radius; dx++) {
          const xx = x + dx
          if (xx < 0 || xx >= width) continue
          const other = yy * width + xx
          if (!alpha(other)) continue
          visible++
          if (labels[other] === label) own++
        }
      }
      if (visible < 8 || own / visible > densityLimit) continue
      // 2 = 强线条，1 = 候选端点；后者需要连接到一个强线条才会保留。
      mask[pos] = pairOpposite || same >= 2 ? 2 : 1
    }
  }

  // 允许细线的末端/弯折，仅保护有足够邻近证据的像素，避免保住孤立杂点。
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const pos = y * width + x
      if (mask[pos] !== 1) continue
      let linked = false
      for (let dy = -1; dy <= 1 && !linked; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue
          if (mask[pos + dy * width + dx] === 2) {
            linked = true
            break
          }
        }
      }
      mask[pos] = linked ? 2 : 0
    }
  }
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] === 2) mask[i] = 1
  }
  return mask
}

/** 可选调试用：返回 0/1 掩码，1 表示平滑前被判为需要保护的细线。 */
export function getLineProtectionMask(
  rgba: Uint8ClampedArray,
  analysis: ColorAnalysis,
  options: AnaV2Options = {}
): Uint8Array {
  const { width, height, labels } = analysis
  if (rgba.length < width * height * 4 || labels.length !== width * height) {
    throw new Error('getLineProtectionMask: image dimensions do not match')
  }
  const pixelLabs = createPixelLabs(rgba, width * height)
  return detectLineMask(rgba, width, height, labels, pixelLabs, {
    lineWindow: options.lineWindow ?? defaultAnalysisOptions.lineWindow,
    lineContrast: options.lineContrast ?? defaultAnalysisOptions.lineContrast,
    lineMaxDensity: options.lineMaxDensity ?? defaultAnalysisOptions.lineMaxDensity
  })
}

/**
 * 有原图色彩引导的轮廓平滑：
 *  - 空间高斯投票保留旧版厚涂感；
 *  - 邻居与中心原图色距过大时降低投票权重，避免跨越真实边界；
 *  - 检测到的细切割线可以直接锁定、或在弱保护模式下获得额外票数；
 *  - 完全透明的像素不参与投票。
 */
function smoothColorRegions(
  analysis: ColorAnalysis,
  rgba: Uint8ClampedArray,
  iterations: number,
  options: Required<AnaV2Options>
): Uint8Array {
  const limit = Math.max(0, Math.min(16, Math.floor(iterations)))
  if (!limit || analysis.palette.length < 2) return analysis.labels
  const { width, height } = analysis
  const size = width * height
  const radius = 3
  const kernel = Float32Array.from(
    { length: radius * 2 + 1 },
    (_, i) => Math.exp(-((i - radius) ** 2) / (2 * 1.4 ** 2))
  )
  const sum = kernel.reduce((a, b) => a + b, 0)
  for (let i = 0; i < kernel.length; i++) kernel[i] = kernel[i]! / sum

  const labs = createPixelLabs(rgba, size)
  const protection = clamp(options.lineProtection, 0, 1)
  const protectedMask = protection > 0
    ? detectLineMask(rgba, width, height, analysis.labels, labs, options)
    : new Uint8Array(size)
  const sigma = Math.max(0.005, options.edgeSigma)
  const invColorVariance = 1 / (2 * sigma * sigma)
  let current = analysis.labels.slice()
  let next = new Uint8Array(size)
  const scores = new Float32Array(analysis.palette.length)
  const touched = new Uint8Array(kernel.length ** 2)

  for (let iteration = 0; iteration < limit; iteration++) {
    next.set(current)
    let changes = 0
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pos = y * width + x
        if (!rgba[pos * 4 + 3]) continue
        const label = current[pos]!
        if (protectedMask[pos] && protection >= 0.999) continue
        if ((x === 0 || current[pos - 1] === label)
          && (x + 1 === width || current[pos + 1] === label)
          && (y === 0 || current[pos - width] === label)
          && (y + 1 === height || current[pos + width] === label)) continue

        let count = 0
        let totalWeight = 0
        for (let dy = -radius; dy <= radius; dy++) {
          const yy = clamp(y + dy, 0, height - 1)
          const vertical = kernel[dy + radius]!
          for (let dx = -radius; dx <= radius; dx++) {
            const xx = clamp(x + dx, 0, width - 1)
            const other = yy * width + xx
            const alpha = rgba[other * 4 + 3]! / 255
            if (alpha === 0) continue
            const neighborLabel = current[other]!
            const contrast = pixelDistance(labs, pos, other)
            const weight = vertical * kernel[dx + radius]! * Math.exp(-contrast * invColorVariance) * alpha
            if (weight < 1e-8) continue
            if (scores[neighborLabel] === 0) touched[count++] = neighborLabel
            scores[neighborLabel] = scores[neighborLabel]! + weight
            totalWeight += weight
          }
        }
        // 介于 0~1 时不硬锁，给细线额外的投票优势。
        if (protectedMask[pos] && protection > 0) scores[label] = scores[label]! + totalWeight * protection * 0.75
        let winner = label
        let maximum = scores[label]!
        for (let n = 0; n < count; n++) {
          const candidate = touched[n]!
          if (scores[candidate]! > maximum + totalWeight * 0.015) {
            winner = candidate
            maximum = scores[candidate]!
          }
        }
        for (let n = 0; n < count; n++) scores[touched[n]!] = 0
        // 上面的保护偏置可能为一个不在 touched 中的标签增加分数，单独复位。
        scores[label] = 0
        next[pos] = winner
        if (winner !== label) changes++
      }
    }
    const previous = current
    current = next
    next = previous
    if (changes === 0) break
  }
  return current
}

export function analyzePixelsV2(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  options: AnaV2Options = {}
): ColorAnalysis {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || rgba.length < width * height * 4) {
    throw new Error('analyzePixelsV2: invalid RGBA input dimensions')
  }
  // 显式传入 undefined 时也使用默认值，与旧版 ?? 行为一致。
  const opt = { ...defaultAnalysisOptions }
  for (const key of Object.keys(options) as (keyof AnaV2Options)[]) {
    const value = options[key]
    if (value !== undefined) Object.assign(opt, { [key]: value })
  }
  let colors = opt.colors === 'auto' ? 26 : clamp(Math.round(opt.colors), 1, 256)
  const connectedPower = clamp(opt.connectedPower, 1, 3)
  const scatteredFloor = clamp(opt.scatteredFloor, 0, 1)
  const areaPower = clamp(opt.areaPower, 0.3, 1)
  const accentMinArea = Math.max(1, Math.round(opt.accentMinArea))
  const size = width * height
  const areaBins = new Float64Array(BIN_COUNT)
  const weightedBins = new Float64Array(BIN_COUNT)
  const redBins = new Float64Array(BIN_COUNT)
  const greenBins = new Float64Array(BIN_COUNT)
  const blueBins = new Float64Array(BIN_COUNT)
  const occupied: number[] = []
  let visible = 0
  let alpha: Uint8Array | undefined

  // 1. 收集 5-bit RGB 桶的总体面积；不再按精确颜色单独计分。
  for (let i = 0; i < size; i++) {
    const off = i * 4
    const opacity = rgba[off + 3]!
    if (opacity !== 255) {
      alpha ??= new Uint8Array(size).fill(255)
      alpha[i] = opacity
    }
    const a = opacity / 255
    if (a === 0) continue
    const r = rgba[off]!, g = rgba[off + 1]!, b = rgba[off + 2]!
    const key = binKey(r, g, b)
    if (areaBins[key] === 0) occupied.push(key)
    const x = (i % width + 0.5) / width * 2 - 1
    const y = (((i / width) | 0) + 0.5) / height * 2 - 1
    const center = Math.max(0, 1 - (x * x + y * y) / 2) ** 2
    areaBins[key] = areaBins[key]! + a
    weightedBins[key] = weightedBins[key]! + a * (1 + Math.max(0, opt.centerWeight) * center)
    redBins[key] = redBins[key]! + a * r
    greenBins[key] = greenBins[key]! + a * g
    blueBins[key] = blueBins[key]! + a * b
    visible += a
  }
  if (visible === 0) return { width, height, palette: [[0, 0, 0]], labels: new Uint8Array(size), alpha }

  const bins = occupied.map(key => makeBin(
    key, areaBins[key]!, weightedBins[key]!, redBins[key]!, greenBins[key]!, blueBins[key]!
  ))
  const { groups, binGroups } = createGroups(bins, opt.mergeRange)
  if (opt.colors === 'auto') {
    // 近色先归并，按透明度加权面积计算有效颜色数；过滤极小色群以免噪点撑大调色板。
    const significant = groups.filter(group => group.area >= visible * 0.001)
    const populations = significant.length ? significant : groups
    const total = populations.reduce((sum, group) => sum + group.area, 0)
    const entropy = populations.reduce((sum, group) => {
      const p = group.area / total
      return sum - p * Math.log(p)
    }, 0)
    colors = clamp(Math.ceil(Math.exp(entropy) - 1e-8), 8, 26)
  }
  // 2. 从全图映射到色群，再计算每个群体在空间上的连通程度。
  const pixelGroups = new Int32Array(size).fill(-1)
  for (let i = 0; i < size; i++) {
    const off = i * 4
    if (rgba[off + 3] === 0) continue
    pixelGroups[i] = binGroups[binKey(rgba[off]!, rgba[off + 1]!, rgba[off + 2]!)]!
  }
  measureComponents(groups, pixelGroups, rgba, width, height, connectedPower, accentMinArea)

  // 3. 连续面积 + 饱和度 + 特色色相 + 边界对比。
  for (const group of groups) {
    const cohesion = group.areaPowerSum / Math.max(EPS, group.area ** connectedPower)
    const continuity = scatteredFloor + (1 - scatteredFloor) * clamp(cohesion, 0, 1)
    const vivid = colorVividness(group.lab)
    const standout = vivid * (0.6 + 1.2 * hueStrength(group.lab))
    const minComponent = Math.min(1, group.maxComponent / accentMinArea)
    const edge = group.strongestEdge / Math.max(1, Math.sqrt(group.area))
    group.score = (group.weightedArea * continuity) ** areaPower
      * (1 + Math.max(0, opt.specialWeight) * standout)
      * (1 + Math.max(0, opt.edgeWeight) * clamp(edge, 0, 1))
    // 第二个专属榜单：让金眼睛、红装饰、蓝色瞳孔等显著色竞争有限名额。
    // 如果一个群体仅有零散的噪点，minComponent 与 area 门槛会限制误选。
    const rarity = (1 + group.area / 2400) ** -0.35
    group.accentScore = minComponent * rarity * vivid ** 1.8
      * (0.65 + 0.35 * hueStrength(group.lab))
      * Math.min(120, group.maxComponent) ** 0.35
      * (0.75 + Math.min(1.5, group.strongestEdge / Math.max(2, Math.sqrt(group.maxComponent))))
  }

  // 4. 保留原版的极亮、极暗锚点，但判断对象变为「色群面积」。
  const reserved: Group[] = []
  const minimumArea = Math.max(2, visible * Math.max(0, opt.anchorMinPercent) / 100)
  const eligible = groups.filter(g => g.area >= minimumArea)
  if (colors >= 2 && eligible.length) {
    const white: Color = [1, 0, 0]
    const black: Color = [0, 0, 0]
    const light = eligible.reduce((best, group) => distance(group.lab, white) < distance(best.lab, white) ? group : best)
    const dark = eligible.reduce((best, group) => distance(group.lab, black) < distance(best.lab, black) ? group : best)
    reserved.push(light)
    if (dark !== light) reserved.push(dark)
  }

  const picked: Group[] = reserved.slice()
  const minDifferent = (Math.max(0, opt.mergeRange) / 100) ** 2 * 0.36
  const tryPick = (candidate: Group): boolean => {
    if (picked.length >= colors) return false
    if (picked.some(other => other.id === candidate.id || distance(other.lab, candidate.lab) <= minDifferent)) return false
    picked.push(candidate)
    return true
  }
  // 显著色按色相家族竞争，每个家族优先得到一个候选位。
  // 否则蓝色面积过大，同一个蓝色家族可能吃掉全部 accentSlots。
  const accentCandidates = groups
    .filter(g => g.maxComponent >= accentMinArea && colorVividness(g.lab) >= 0.25)
    .sort((a, b) => b.accentScore - a.accentScore || b.score - a.score)
  const family = (lab: Color): string => {
    const hue = (Math.atan2(lab[2], lab[1]) * 180 / Math.PI + 360) % 360
    if (hue < 35 || hue >= 345) return 'red'
    if (hue < 125) return 'yellow'
    if (hue < 205) return 'green'
    if (hue < 285) return 'blue'
    return 'purple'
  }
  const families = ['yellow', 'red', 'purple', 'blue', 'green'] as const
  let accented = 0
  const targetAccents = clamp(Math.floor(opt.accentSlots), 0, colors - reserved.length)
  for (const name of families) {
    if (accented >= targetAccents) break
    const candidate = accentCandidates.find(g => family(g.lab) === name
      && !picked.some(p => p.id === g.id || distance(p.lab, g.lab) <= minDifferent))
    if (candidate && tryPick(candidate)) accented++
  }
  // 没有足够多的色相家族时，不强塞低质量的噪点候选。
  // 普通分数排序仍可以选出同家族的其它颜色。
  for (const group of groups.slice().sort((a, b) => b.score - a.score || a.id - b.id)) {
    if (picked.length >= colors) break
    tryPick(group)
  }
  // 如果距离阈值太大，允许补足颜色位，以避免调色板比 colors 小很多。
  if (picked.length < colors) {
    for (const group of groups.slice().sort((a, b) => b.score - a.score || a.id - b.id)) {
      if (picked.length >= colors) break
      if (!picked.some(g => g.id === group.id)) picked.push(group)
    }
  }
  const palette: Color[] = picked.map(g => g.rgb.map(asByte) as Color)
  if (!palette.length) palette.push([0, 0, 0])

  // 5. 依旧将每个原图像素归入最近调色板颜色，而不是强制整组同色。
  const paletteLabs = palette.map(rgb => toOklab(...rgb))
  const mappedBins = new Uint8Array(BIN_COUNT)
  for (const bin of bins) {
    let nearest = 0
    let minDistance = Infinity
    for (let j = 0; j < paletteLabs.length; j++) {
      const value = distance(bin.lab, paletteLabs[j]!)
      if (value < minDistance) {
        nearest = j
        minDistance = value
      }
    }
    mappedBins[bin.key] = nearest
  }
  const labels = new Uint8Array(size)
  for (let i = 0; i < size; i++) {
    const off = i * 4
    if (rgba[off + 3] === 0) continue
    labels[i] = mappedBins[binKey(rgba[off]!, rgba[off + 1]!, rgba[off + 2]!)]!
  }
  const result: ColorAnalysis = { width, height, palette, labels, ...(alpha ? { alpha } : {}) }
  result.labels = smoothColorRegions(result, rgba, opt.contourSteps, opt)
  return result
}
