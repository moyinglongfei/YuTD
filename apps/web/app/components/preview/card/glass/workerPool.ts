// 多线程
import { toRaw } from 'vue'
import type { SimplifiedImageData } from '../../../../utils/simplifyImage'
import type { GlassEffectOptions, GlassEffects, GlassWorkerMessage, GlassWorkerReply } from './edges'

interface ImageEntry { id: number, users: number }
interface WorkerGroup {
  worker: Worker
  clients: Set<number>
  images: Map<SimplifiedImageData, ImageEntry>
  pending: Map<number, { request: number, resolve: (result: GlassEffects) => void, reject: (error: Error) => void }>
  failed: boolean
}
const groups: WorkerGroup[] = []
let sequence = 0
function createGroup(): WorkerGroup {
  const group: WorkerGroup = {
    worker: new Worker(new URL('./glass.worker.ts', import.meta.url), { type: 'module' }),
    clients: new Set(), images: new Map(), pending: new Map(), failed: false
  }
  group.worker.onmessage = ({ data }: MessageEvent<GlassWorkerReply>) => {
    const pending = group.pending.get(data.client)
    if (!pending || pending.request !== data.request) return
    group.pending.delete(data.client)
    if ('error' in data) pending.reject(new Error(data.error))
    else pending.resolve(data.result)
  }
  const fail = () => {
    group.failed = true
    group.worker.terminate()
    for (const request of group.pending.values()) request.reject(new Error('玻璃计算线程不可用'))
    group.pending.clear()
    group.images.clear()
    const index = groups.indexOf(group)
    if (index >= 0) groups.splice(index, 1)
  }
  group.worker.onerror = fail
  group.worker.onmessageerror = fail
  groups.push(group)
  return group
}

export function createGlassWorkerClient() {
  const group = groups.find(group => group.clients.size < 4) ?? createGroup()
  const client = ++sequence
  group.clients.add(client)
  let image: SimplifiedImageData | undefined
  let disposed = false
  const post = (message: GlassWorkerMessage) => group.worker.postMessage(message)
  function releaseImage() {
    if (!image) return
    const entry = group.images.get(image)
    if (entry && --entry.users === 0) {
      group.images.delete(image)
      if (!group.failed) post({ type: 'delete-image', id: entry.id })
    }
    image = undefined
  }
  return {
    render(data: SimplifiedImageData, options: GlassEffectOptions): Promise<GlassEffects> {
      if (disposed || group.failed) return Promise.reject(new Error('玻璃计算线程已释放'))
      if (group.pending.has(client)) return Promise.reject(new Error('玻璃计算请求尚未完成'))
      return new Promise((resolve, reject) => {
        try {
          data = toRaw(data)
          if (image !== data) {
            releaseImage()
            let entry = group.images.get(data)
            if (!entry) {
              entry = { id: ++sequence, users: 0 }
              post({ type: 'image', id: entry.id, data: {
                width: data.width, height: data.height,
                palette: toRaw(data.palette).map(color => [...toRaw(color)] as [number, number, number]),
                labels: toRaw(data.labels),
                ...(data.alpha ? { alpha: toRaw(data.alpha) } : {})
              } })
              group.images.set(data, entry)
            }
            entry.users++
            image = data
          }
          const request = ++sequence
          group.pending.set(client, { request, resolve, reject })
          post({ type: 'compute', client, request, image: group.images.get(data)!.id, options })
        } catch (error) {
          group.pending.delete(client)
          reject(error)
        }
      })
    },
    dispose() {
      if (disposed) return
      disposed = true
      group.pending.get(client)?.reject(new Error('玻璃计算已取消'))
      group.pending.delete(client)
      releaseImage()
      group.clients.delete(client)
      if (!group.failed) post({ type: 'dispose', client })
      if (!group.clients.size && !group.failed) {
        group.worker.terminate()
        groups.splice(groups.indexOf(group), 1)
      }
    }
  }
}
