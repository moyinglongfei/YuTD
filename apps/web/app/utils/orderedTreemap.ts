/**
 * Order-preserving squarified treemap.
 *
 * 按权重分配面积，保留大体顺序，
 * 支持每个元素的期望宽高比（软约束）。
 */

export interface MosaicItem {
  id: string | number
  /** 相对面积权重 */
  weight?: number
  /** 期望宽高比 width / height */
  preferredAspectRatio?: number
}

export interface MosaicRect {
  x: number
  y: number
  width: number
  height: number
}

export interface MosaicLayoutOptions {
  /** 形状偏好的影响强度，0 表示忽略 */
  aspectPreferenceStrength?: number
  aspectDiversityStrength?: number
}

interface Entry {
  index: number
  area: number
}

const EPSILON = 1e-9

function worstAspectRatio(
  entries: Entry[],
  side: number
): number {
  if (!entries.length || side <= EPSILON)
    return Infinity

  let sum = 0
  let min = Infinity
  let max = 0

  for (const entry of entries) {
    sum += entry.area
    min = Math.min(min, entry.area)
    max = Math.max(max, entry.area)
  }

  const square = side * side

  return Math.max(
    square * max / (sum * sum),
    sum * sum / (square * min)
  )
}

export function getMosaicWeight(item: MosaicItem): number {
  const weight = item.weight ?? 1
  return Number.isFinite(weight) && weight > 0 ? weight : 1
}

/**
 * 综合评分：
 * 1. 尽量避免过度细长的矩形
 * 2. 尽量满足元素指定的期望宽高比
 *
 * 分数越低越好。
 */
function scoreStrip(
  entries: Entry[],
  remaining: MosaicRect,
  items: readonly MosaicItem[],
  strength: number,
  diversityStrength: number,
  previousLogRatio?: number
): number {
  const side = Math.min(
    remaining.width,
    remaining.height
  )

  // ① 保留原来的基础评分
  const baseScore = Math.log(
    worstAspectRatio(entries, side)
  )

  if (side <= EPSILON)
    return baseScore

  const stripArea = entries.reduce(
    (sum, entry) => sum + entry.area,
    0
  )

  const thickness = stripArea / side
  const isColumn
    = remaining.width >= remaining.height

  let maxPreferenceError = 0

  // ② 差异性奖励
  let diversitySum = 0
  let diversityPairs = 0

  // 上一张卡片的对数宽高比
  let previous = previousLogRatio

  for (const entry of entries) {
    const actualRatio = isColumn
      ? thickness ** 2 / entry.area
      : entry.area / thickness ** 2

    const logRatio = Math.log(actualRatio)

    // 比较当前卡片与前一张卡片
    if (previous !== undefined) {
      const difference = Math.min(
        1,
        Math.abs(logRatio - previous)
        / Math.log(1.6)
      )

      diversitySum += difference
      diversityPairs++
    }

    previous = logRatio

    // ③ 保留原有的期望宽高比评分
    const preferred
      = items[entry.index]?.preferredAspectRatio

    if (
      strength > 0
      && preferred !== undefined
      && Number.isFinite(preferred)
      && preferred > 0
    ) {
      const error = Math.abs(
        logRatio - Math.log(preferred)
      )

      maxPreferenceError = Math.max(
        maxPreferenceError,
        error
      )
    }
  }

  const diversityBonus = diversityPairs > 0
    ? diversitySum / diversityPairs
    : 0

  // ④ 合成最终评分
  return baseScore
    + strength * maxPreferenceError
    - diversityStrength * diversityBonus
}

export function layoutOrderedTreemap(
  items: readonly MosaicItem[],
  width: number,
  height: number,
  options: MosaicLayoutOptions = {}
): MosaicRect[] {
  const diversityStrength = Math.max(
    0,
    options.aspectDiversityStrength ?? 0.6
  )
  if (!items.length || width <= 0 || height <= 0)
    return []

  const strength = Math.max(
    0,
    options.aspectPreferenceStrength ?? 3
  )

  const weights = items.map(getMosaicWeight)
  const totalWeight = weights.reduce(
    (sum, weight) => sum + weight,
    0
  )

  const areaFactor = width * height / totalWeight

  const entries: Entry[] = weights.map((weight, index) => ({
    index,
    area: weight * areaFactor
  }))

  const result: MosaicRect[] = new Array(items.length)

  let remaining: MosaicRect = {
    x: 0,
    y: 0,
    width,
    height
  }

  let strip: Entry[] = []
  let processed = 0

  function placeStrip() {
    if (!strip.length) return

    const isColumn = remaining.width >= remaining.height

    const stripArea = strip.reduce(
      (sum, entry) => sum + entry.area,
      0
    )

    const isLastStrip
      = processed + strip.length === entries.length

    if (isColumn) {
      const stripWidth = isLastStrip
        ? remaining.width
        : Math.min(
            remaining.width,
            stripArea / remaining.height
          )

      let y = remaining.y

      strip.forEach((entry, position) => {
        const tileHeight = position === strip.length - 1
          ? remaining.y + remaining.height - y
          : entry.area / stripWidth

        result[entry.index] = {
          x: remaining.x,
          y,
          width: stripWidth,
          height: tileHeight
        }

        y += tileHeight
      })

      remaining = {
        x: remaining.x + stripWidth,
        y: remaining.y,
        width: Math.max(0, remaining.width - stripWidth),
        height: remaining.height
      }
    } else {
      const stripHeight = isLastStrip
        ? remaining.height
        : Math.min(
            remaining.height,
            stripArea / remaining.width
          )

      let x = remaining.x

      strip.forEach((entry, position) => {
        const tileWidth = position === strip.length - 1
          ? remaining.x + remaining.width - x
          : entry.area / stripHeight

        result[entry.index] = {
          x,
          y: remaining.y,
          width: tileWidth,
          height: stripHeight
        }

        x += tileWidth
      })

      remaining = {
        x: remaining.x,
        y: remaining.y + stripHeight,
        width: remaining.width,
        height: Math.max(0, remaining.height - stripHeight)
      }
    }

    processed += strip.length
    strip = []
  }

  for (const entry of entries) {
    if (!strip.length) {
      strip.push(entry)
      continue
    }

    const candidate = [...strip, entry]

    // 使用新的综合评分决定是否继续添加
    const previousRect = processed > 0
      ? result[processed - 1]
      : undefined

    const previousLogRatio = previousRect
      && previousRect.width > 0
      && previousRect.height > 0
      ? Math.log(
          previousRect.width / previousRect.height
        )
      : undefined

    const currentScore = scoreStrip(
      strip,
      remaining,
      items,
      strength,
      diversityStrength,
      previousLogRatio
    )

    const candidateScore = scoreStrip(
      candidate,
      remaining,
      items,
      strength,
      diversityStrength,
      previousLogRatio
    )

    if (candidateScore <= currentScore) {
      strip.push(entry)
    } else {
      placeStrip()
      strip.push(entry)
    }
  }

  placeStrip()

  return result
}
