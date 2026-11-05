// 多线程
import { computeGlassEffects } from './edges'
import type { GlassWorkerMessage, GlassWorkerReply } from './edges'
import type { SimplifiedImageData } from '../../../../utils/simplifyImage'

const scope = globalThis as unknown as {
  onmessage: (event: MessageEvent<GlassWorkerMessage>) => void
  postMessage: (reply: GlassWorkerReply, transfer?: Transferable[]) => void
}
const images = new Map<number, SimplifiedImageData>()
const canvases = new Map<number, OffscreenCanvas>()
scope.onmessage = ({ data: message }) => {
  if (message.type === 'image') images.set(message.id, message.data)
  else if (message.type === 'delete-image') images.delete(message.id)
  else if (message.type === 'dispose') canvases.delete(message.client)
  else {
    try {
      const image = images.get(message.image)
      if (!image) throw new Error('缺少玻璃背景数据')
      let canvas = canvases.get(message.client)
      if (!canvas) {
        canvas = new OffscreenCanvas(1, 1)
        canvases.set(message.client, canvas)
      }
      const result = computeGlassEffects(canvas, image, message.options)
      scope.postMessage({ client: message.client, request: message.request, result }, [result.pixels.data.buffer])
    } catch (error) {
      scope.postMessage({ client: message.client, request: message.request, error: error instanceof Error ? error.message : String(error) })
    }
  }
}
