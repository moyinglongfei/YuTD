export const MAX_IMAGE_BYTES = 20 * 1024 * 1024
export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'] as const

export interface ImagePosition {
  originalWidth: number
  originalHeight: number
  x: number
  y: number
  width: number
  height: number
}

export interface StoredImage {
  id: string
  name: string
  mimeType: string
  size: number
  originalSize: number
  width: number
  height: number
  createdAt: string
  url: string
  thumbnailUrl: string
  thumbnailSize: number | null
  thumbnailWidth: number | null
  thumbnailHeight: number | null
  backgroundKeys?: string[]
}

export interface ImageList {
  items: StoredImage[]
  total: number
  limit: number
  offset: number
}

export interface ImageListQuery {
  limit?: number
  offset?: number
  search?: string
}

export interface ImageRotation {
  items: { image: StoredImage, enabled: boolean, position: number | null }[]
  total: number
  remaining: number
}

export function formatImageBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}
