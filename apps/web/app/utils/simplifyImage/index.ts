import { analyzeImage, createColorPixels } from './utils'
import type { AnaV2Options } from './anav2'
import { encodeIndexedPng } from './png'

export { analyzePixelsV2, defaultAnalysisOptions, toOklab } from './anav2'
export type { AnaV2Options, ColorAnalysis } from './anav2'

export interface SimplifiedImageData {
  width: number
  height: number
  palette: [number, number, number][]
  labels: number[]
  /** 逐像素透明度，0~255；省略时全部不透明。 */
  alpha?: number[]
}

export interface SimplifiedImageComparison {
  png: Blob
  plainPng: Blob
  colorCount: number
  width: number
  height: number
}

export function simplifyImage(blob: Blob, format: 'comparison', options?: AnaV2Options): Promise<SimplifiedImageComparison>
export function simplifyImage(blob: Blob, format: 'json', options?: AnaV2Options): Promise<SimplifiedImageData>
export function simplifyImage(blob: Blob, format?: 'png', options?: AnaV2Options): Promise<Blob>
export async function simplifyImage(blob: Blob, format: 'json' | 'png' | 'comparison' = 'png', options?: AnaV2Options): Promise<SimplifiedImageData | SimplifiedImageComparison | Blob> {
  const url = URL.createObjectURL(blob)
  try {
    const image = new Image()
    image.src = url
    await image.decode()

    const analysis = await analyzeImage(image, options)
    const { width, height, palette, labels, alpha } = analysis

    if (format === 'json') {
      return { width, height, palette, labels: Array.from(labels), ...(alpha ? { alpha: Array.from(alpha) } : {}) }
    }

    const { pixels } = createColorPixels(analysis)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('无法创建简化图片画布')
    context.putImageData(new ImageData(new Uint8ClampedArray(pixels), width, height), 0, 0)

    const original = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(value => value ? resolve(value) : reject(new Error('生成简化图片失败')), 'image/png')
    })
    const indexed = await encodeIndexedPng(analysis).catch(() => null)
    const png = indexed && indexed.size < original.size ? indexed : original
    if (format === 'comparison') return { png, plainPng: original, colorCount: palette.length, width, height }
    return png
  } finally {
    URL.revokeObjectURL(url)
  }
}
