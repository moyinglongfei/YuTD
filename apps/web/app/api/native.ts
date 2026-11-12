import type { createWebApi } from './web'
import type { ApiData } from '~/utils/api'
import { Capacitor } from '@capacitor/core'
import { MAX_IMAGE_BYTES } from '#shared/images'
import type { StoredImage, ImageList, ImageRotation } from '#shared/images'

type WebApi = ReturnType<typeof createWebApi>
export type LocalPreferences = ApiData<WebApi['api']['preferences']['get']>
export type LocalStyle = ApiData<WebApi['api']['style']['get']>[number]
type CreateStyle = Parameters<WebApi['api']['style']['post']>[0]
type Routes = WebApi['api']
type Phase = ReturnType<Routes['phase']>
type Event = ReturnType<Routes['event']>
type Schedule = ReturnType<Routes['event-schedule']>
type Task = ReturnType<Routes['task']>
type Tip = ReturnType<Routes['tip']>
type Wire<T> = T extends Date ? string : T extends (infer Item)[] ? Wire<Item>[] : T extends object ? { [Key in keyof T]: Wire<T[Key]> } : T
type Result<Method> = Wire<ApiData<Method>>
type Body<Method> = Method extends (...args: infer Args) => unknown ? Args[0] : never
interface NativeOptions { query?: Record<string, unknown>, signal?: AbortSignal }
interface NativeFile { uri: string, mimeType: string, name: string }
const routeParameter = Symbol('nativeRouteParameter')

function resource<Id extends number | string, Detail, Methods>(key: string, resolve: (id: Id) => Detail, methods: Methods, numeric = true) {
  return Object.assign((params: Record<string, Id>) => resolve(params[key]!), methods, { [routeParameter]: { key, numeric } })
}

export interface NativeCapabilities {
  bridgeVersion: number
  features: string[]
}

export interface NativeBridge {
  getCapabilities(): Promise<NativeCapabilities>
  getPreferences(): Promise<LocalPreferences>
  updatePreferences(options: { data: Partial<LocalPreferences>, replace?: boolean }): Promise<LocalPreferences>
  resetPreferences(): Promise<LocalPreferences>
  getDataVersion(): Promise<{ version: string }>
  listStyles(): Promise<{ styles: LocalStyle[] }>
  getStyle(options: { id: number }): Promise<LocalStyle>
  createStyle(options: { data: CreateStyle }): Promise<LocalStyle>
  updateStyle(options: { id: number, data: Partial<Omit<LocalStyle, 'id'>> }): Promise<LocalStyle>
  listPhases(): Promise<{ items: Result<Routes['phase']['get']> }>
  getPhase(options: { id: number }): Promise<Result<Phase['get']>>
  createPhase(options: { data: Body<Routes['phase']['post']> }): Promise<Result<Routes['phase']['post']>>
  updatePhase(options: { id: number, data: Body<Phase['patch']> }): Promise<Result<Phase['patch']>>
  deletePhase(options: { id: number }): Promise<Result<Phase['delete']>>
  listEvents(options: { query?: Record<string, unknown> }): Promise<{ items: Result<Routes['event']['get']> }>
  getEvent(options: { id: number }): Promise<Result<Event['get']>>
  createEvent(options: { data: Body<Routes['event']['post']> }): Promise<Result<Routes['event']['post']>>
  updateEvent(options: { id: number, data: Body<Event['patch']> }): Promise<Result<Event['patch']>>
  deleteEvent(options: { id: number }): Promise<Result<Event['delete']>>
  listSchedules(options: { query?: Record<string, unknown> }): Promise<{ items: Result<Routes['event-schedule']['get']> }>
  createSchedule(options: { data: Body<Routes['event-schedule']['post']> }): Promise<Result<Routes['event-schedule']['post']>>
  updateSchedule(options: { id: number, data: Body<Schedule['patch']> }): Promise<Result<Schedule['patch']>>
  deleteSchedule(options: { id: number }): Promise<Result<Schedule['delete']>>
  listTasks(options: { query?: Record<string, unknown> }): Promise<{ items: Result<Routes['task']['get']> }>
  createTask(options: { data: Body<Routes['task']['post']> }): Promise<Result<Routes['task']['post']>>
  updateTask(options: { id: number, data: Body<Task['patch']> }): Promise<Result<Task['patch']>>
  postponeTask(options: { id: number, data: Body<Task['postpone']['patch']> }): Promise<Result<Task['postpone']['patch']>>
  dailyTasks(options: { query?: Record<string, unknown> }): Promise<Result<Routes['dailytask']['get']>>
  weeklyTasks(options: { query?: Record<string, unknown> }): Promise<Result<Routes['weeklytask']['get']>>
  setDailyTasks(options: { query?: Record<string, unknown>, data: Body<Routes['dailytask']['patch']> }): Promise<Result<Routes['dailytask']['patch']>>
  setWeeklyTasks(options: { query?: Record<string, unknown>, data: Body<Routes['weeklytask']['patch']> }): Promise<Result<Routes['weeklytask']['patch']>>
  listTips(options: { query?: Record<string, unknown> }): Promise<{ items: Result<Routes['tip']['get']> }>
  getTip(options: { id: number }): Promise<Result<Tip['get']>>
  createTip(options: { data: Body<Routes['tip']['post']> }): Promise<Result<Routes['tip']['post']>>
  updateTip(options: { id: number, data: Body<Tip['patch']> }): Promise<Result<Tip['patch']>>
  deleteTip(options: { id: number }): Promise<Result<Tip['delete']>>
  dailyTips(options: { query?: Record<string, unknown> }): Promise<Result<Routes['dailytips']['get']>>
  listResources(options: { query?: Record<string, unknown> }): Promise<Result<Routes['resource']['get']>>
  getConfig(): Promise<Result<Routes['config']['get']>>
  updateConfig(options: { data: Body<Routes['config']['patch']> }): Promise<Result<Routes['config']['patch']>>
  login(options: { data: Body<Routes['auth']['login']['post']> }): Promise<{ token: string }>
  listImages(options: { query?: Record<string, unknown> }): Promise<ImageList>
  getImage(options: { id: string }): Promise<StoredImage>
  getImageFile(options: { id: string, thumbnail: boolean }): Promise<NativeFile>
  deleteImage(options: { id: string }): Promise<{ id: string }>
  beginImageUpload(options: { data: { name: string, size: number, thumbnailSize: number } }): Promise<{ uploadId: string }>
  appendImageUpload(options: { data: { uploadId: string, part: string, offset: number, base64: string } }): Promise<{ offset: number }>
  finishImageUpload(options: { uploadId: string }): Promise<StoredImage>
  cancelImageUpload(options: { uploadId: string }): Promise<{ cancelled: boolean }>
  getImageRotation(): Promise<ImageRotation>
  updateImageRotation(options: { data: Body<Routes['image']['random']['patch']> }): Promise<ImageRotation>
  getImageBackground(options: { query?: Record<string, unknown> }): Promise<Result<Routes['image']['background']['get']>>
  bindImageBackground(options: { data: Body<Routes['image']['background']['patch']> }): Promise<Result<Routes['image']['background']['patch']>>
  randomImage(options: { random: string, query?: Record<string, unknown> }): Promise<Result<ReturnType<Routes['image']['random']>['get']>>
}

async function uploadImage(bridge: NativeBridge, data: { file: File, thumbnail: File }, options?: NativeOptions) {
  if (!(data?.file instanceof File) || !(data.thumbnail instanceof File)
    || [data.file, data.thumbnail].some(file => file.size < 1 || file.size > MAX_IMAGE_BYTES)) {
    throw Object.assign(new Error('请选择不超过 20 MB 的图片和 PNG 简化图'), { code: 'VALIDATION' })
  }
  options?.signal?.throwIfAborted()
  const { uploadId } = await bridge.beginImageUpload({ data: { name: data.file.name, size: data.file.size, thumbnailSize: data.thumbnail.size } })
  try {
    for (const part of ['file', 'thumbnail'] as const) {
      const file = data[part]
      for (let offset = 0; offset < file.size; offset += 256 * 1024) {
        options?.signal?.throwIfAborted()
        const bytes = new Uint8Array(await file.slice(offset, offset + 256 * 1024).arrayBuffer())
        let binary = ''
        for (let start = 0; start < bytes.length; start += 8192) binary += String.fromCharCode(...bytes.subarray(start, start + 8192))
        await bridge.appendImageUpload({ data: { uploadId, part, offset, base64: btoa(binary) } })
      }
    }
    options?.signal?.throwIfAborted()
    return await bridge.finishImageUpload({ uploadId })
  } catch (error) {
    await bridge.cancelImageUpload({ uploadId }).catch(() => {})
    throw error
  }
}

async function imageFile(bridge: NativeBridge, id: string, thumbnail: boolean, options?: NativeOptions) {
  options?.signal?.throwIfAborted()
  const file = await bridge.getImageFile({ id, thumbnail })
  const response = await fetch(Capacitor.convertFileSrc(file.uri), { signal: options?.signal })
  if (!response.ok) throw Object.assign(new Error('图片文件不存在'), { code: 'NOT_FOUND' })
  return new Response(response.body, { headers: { 'content-type': file.mimeType, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' } })
}

export function createNativeApi(bridge: NativeBridge) {
  const style = resource('id', (id: number) => ({
    get: () => bridge.getStyle({ id }),
    patch: (data: Partial<Omit<LocalStyle, 'id'>>) => bridge.updateStyle({ id, data })
  }), {
    get: async () => (await bridge.listStyles()).styles,
    post: (data: CreateStyle) => bridge.createStyle({ data })
  }
  )

  const phase = resource('id', (id: number) => ({
    get: () => bridge.getPhase({ id }), patch: (data: Body<Phase['patch']>) => bridge.updatePhase({ id, data }), delete: () => bridge.deletePhase({ id })
  }), { get: async () => (await bridge.listPhases()).items, post: (data: Body<Routes['phase']['post']>) => bridge.createPhase({ data }) })
  const event = resource('id', (id: number) => ({
    get: () => bridge.getEvent({ id }), patch: (data: Body<Event['patch']>) => bridge.updateEvent({ id, data }), delete: () => bridge.deleteEvent({ id })
  }), { get: async (options?: NativeOptions) => (await bridge.listEvents({ query: options?.query })).items, post: (data: Body<Routes['event']['post']>) => bridge.createEvent({ data }) })
  const schedule = resource('id', (id: number) => ({
    patch: (data: Body<Schedule['patch']>) => bridge.updateSchedule({ id, data }), delete: () => bridge.deleteSchedule({ id })
  }), { get: async (options?: NativeOptions) => (await bridge.listSchedules({ query: options?.query })).items, post: (data: Body<Routes['event-schedule']['post']>) => bridge.createSchedule({ data }) })
  const task = resource('id', (id: number) => ({
    patch: (data: Body<Task['patch']>) => bridge.updateTask({ id, data }),
    postpone: { patch: (data: Body<Task['postpone']['patch']>) => bridge.postponeTask({ id, data }) }
  }), { get: async (options?: NativeOptions) => (await bridge.listTasks({ query: options?.query })).items, post: (data: Body<Routes['task']['post']>) => bridge.createTask({ data }) })
  const tip = resource('id', (id: number) => ({
    get: () => bridge.getTip({ id }), patch: (data: Body<Tip['patch']>) => bridge.updateTip({ id, data }), delete: () => bridge.deleteTip({ id })
  }), { get: async (options?: NativeOptions) => (await bridge.listTips({ query: options?.query })).items, post: (data: Body<Routes['tip']['post']>) => bridge.createTip({ data }) })
  const image = resource('id', (id: string) => ({
    get: () => bridge.getImage({ id }), delete: () => bridge.deleteImage({ id }),
    file: { get: (options?: NativeOptions) => imageFile(bridge, id, false, options) },
    thumbnail: { get: (options?: NativeOptions) => imageFile(bridge, id, true, options) }
  }), {
    get: (options?: NativeOptions) => bridge.listImages({ query: options?.query }),
    post: Object.assign((data: { file: File, thumbnail: File }, options?: NativeOptions) => uploadImage(bridge, data, options), { status: 201 }),
    background: {
      get: (options?: NativeOptions) => bridge.getImageBackground({ query: options?.query }),
      patch: (data: Body<Routes['image']['background']['patch']>) => bridge.bindImageBackground({ data })
    },
    random: resource('random', (random: string) => ({ get: (options?: NativeOptions) => bridge.randomImage({ random, query: options?.query }) }), {
      get: () => bridge.getImageRotation(), patch: (data: Body<Routes['image']['random']['patch']>) => bridge.updateImageRotation({ data })
    }, false)
  }, false)

  return {
    api: {
      'version': { get: () => bridge.getDataVersion() },
      'preferences': {
        get: () => bridge.getPreferences(),
        patch: (data: Partial<LocalPreferences>) => bridge.updatePreferences({ data }),
        put: (data: LocalPreferences) => bridge.updatePreferences({ data, replace: true }),
        reset: { post: () => bridge.resetPreferences() }
      },
      style, phase, event, 'event-schedule': schedule, task, tip, image,
      'dailytask': {
        get: (options?: NativeOptions) => bridge.dailyTasks({ query: options?.query }),
        patch: (data: Body<Routes['dailytask']['patch']>, options?: NativeOptions) => bridge.setDailyTasks({ data, query: options?.query })
      },
      'weeklytask': {
        get: (options?: NativeOptions) => bridge.weeklyTasks({ query: options?.query }),
        patch: (data: Body<Routes['weeklytask']['patch']>, options?: NativeOptions) => bridge.setWeeklyTasks({ data, query: options?.query })
      },
      'dailytips': { get: (options?: NativeOptions) => bridge.dailyTips({ query: options?.query }) },
      'resource': { get: (options?: NativeOptions) => bridge.listResources({ query: options?.query }) },
      'config': { get: () => bridge.getConfig(), patch: (data: Body<Routes['config']['patch']>) => bridge.updateConfig({ data }) },
      'auth': { login: { post: (data: Body<Routes['auth']['login']['post']>) => bridge.login({ data }) } }
    }
  }
}

const nativeErrorStatus: Record<string, number> = {
  VALIDATION: 400,
  NOT_FOUND: 404,
  UNIMPLEMENTED: 501,
  UNAVAILABLE: 503,
  DATABASE_ERROR: 500,
  CONFLICT: 409, UNAUTHORIZED: 401
}

function routeMember(route: unknown, key: string): unknown {
  if (route === null || !['object', 'function'].includes(typeof route)
    || !Object.prototype.propertyIsEnumerable.call(route, key)) return undefined
  return (route as Record<string, unknown>)[key]
}

export function createNativeFetcher(bridge: NativeBridge | null): typeof fetch {
  return Object.assign(async (input: Parameters<typeof fetch>[0], options?: Parameters<typeof fetch>[1]) => {
    const request = new Request(input, options)
    request.signal.throwIfAborted()
    if (!bridge) {
      return Response.json({ message: '原生本地接口不可用，请安装支持本地数据的应用版本', code: 'UNAVAILABLE' }, { status: 503 })
    }

    const url = new URL(request.url)
    const path = url.pathname.replace(/\/+$/, '')
    const method = request.method
    const authToken = request.headers.get('authorization')?.replace(/^Bearer /, '')
    const api = createNativeApi(new Proxy(bridge, {
      get(target, key) {
        const member = Reflect.get(target, key)
        return typeof member === 'function'
          ? (options?: object) => Reflect.apply(member, target, [{ ...options, ...(authToken ? { authToken } : {}) }])
          : member
      }
    }))
    const body = async () => {
      if (request.headers.get('content-type')?.includes('multipart/form-data')) return Object.fromEntries(await request.formData())
      const value: unknown = await request.json()
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        throw Object.assign(new Error('请求数据必须是对象'), { code: 'VALIDATION' })
      }
      return value
    }

    try {
      let route: unknown = api
      for (const part of path.split('/').filter(Boolean)) {
        const segment = decodeURIComponent(part)
        const parameter = typeof route === 'function' ? Reflect.get(route, routeParameter) as { key: string, numeric: boolean } | undefined : undefined
        if (parameter && !routeMember(route, segment)) {
          const id = parameter.numeric ? Number(segment) : segment
          if (parameter.numeric && (!/^[1-9]\d*$/.test(segment) || !Number.isSafeInteger(id))) {
            throw Object.assign(new Error('id 必须是安全范围内的正整数'), { code: 'VALIDATION' })
          }
          route = (route as (options: Record<string, string | number>) => unknown)({ [parameter.key]: id })
        } else route = routeMember(route, segment)
      }
      const handler = routeMember(route, method.toLowerCase())
      if (typeof handler !== 'function') {
        return Response.json({ message: `本地接口尚未接入：${method} ${path}`, code: 'UNIMPLEMENTED' }, { status: 501 })
      }
      const nativeOptions = { query: Object.fromEntries(url.searchParams), signal: request.signal }
      const data: unknown = await (['GET', 'DELETE', 'HEAD'].includes(method)
        ? handler(nativeOptions)
        : handler(request.body === null ? undefined : await body(), nativeOptions))
      request.signal.throwIfAborted()
      if (data instanceof Response) return data
      const status = routeMember(handler, 'status')
      return Response.json({ code: 0, message: 'ok', data }, { status: typeof status === 'number' ? status : 200 })
    } catch (error) {
      request.signal.throwIfAborted()
      const code = error instanceof SyntaxError || error instanceof URIError
        ? 'VALIDATION'
        : error && typeof error === 'object' && 'code' in error ? String(error.code) : 'DATABASE_ERROR'
      const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : '本地接口调用失败'
      return Response.json({ message, code }, { status: nativeErrorStatus[code] ?? 500 })
    }
  }, { preconnect: () => undefined })
}
