import { computed, onMounted, ref, toRaw, toValue, watch } from 'vue'
import type { ComputedRef, MaybeRefOrGetter } from 'vue'
import { useAppErrors } from '../useApp/useAppErrors'
import { clearCache, readCache, removeCache, writeCache } from './storage'
import type { CacheRecord } from './storage'

interface CacheState {
  records: Record<string, CacheRecord>
  initialized: boolean
  updatedAt: number | null
}

interface IndexedDBCache<T extends CacheRecord, Data> {
  data: ComputedRef<Data>
  initialized: ComputedRef<boolean>
  updatedAt: ComputedRef<number | null>
  pending: ComputedRef<boolean>
  read: (force?: boolean) => Promise<Data>
  write: (value: T | T[]) => Promise<void>
  remove: (id?: string | number) => Promise<void>
  clear: () => Promise<void>
}

// 同一 Nuxt 应用中的操作按分类排队，避免读取、批量写入和删除互相覆盖。
const queues = new WeakMap<object, Map<string, Promise<unknown>>>()

export function useIndexedDB<T extends CacheRecord>(
  folder: MaybeRefOrGetter<string>
): IndexedDBCache<T, T[]>
export function useIndexedDB<T extends CacheRecord>(
  folder: MaybeRefOrGetter<string>,
  id: MaybeRefOrGetter<string | number | null | undefined>
): IndexedDBCache<T, T | undefined>
export function useIndexedDB<T extends CacheRecord>(
  folder: MaybeRefOrGetter<string>,
  id?: MaybeRefOrGetter<string | number | null | undefined>
): IndexedDBCache<T, T[] | T | undefined> {
  const states = useState<Record<string, CacheState>>('indexed-db:tables', () => ({}))
  const { reportError } = useAppErrors()
  const operations = ref(0)
  const single = arguments.length > 1
  let mounted = false
  let queue = queues.get(states.value)
  if (!queue) {
    queue = new Map()
    queues.set(states.value, queue)
  }
  const groupQueue = queue

  function target() {
    const group = toValue(folder)
    const state = states.value[group] ??= { records: {}, initialized: false, updatedAt: null }
    return { group, state }
  }

  function select(state: CacheState, selectedId: string | number | null | undefined) {
    if (!single)
      return Object.values(state.records) as T[]
    return selectedId == null ? undefined : state.records[JSON.stringify(selectedId)] as T | undefined
  }

  const data = computed(() => select(target().state, toValue(id)))
  const initialized = computed(() => target().state.initialized)
  const updatedAt = computed(() => target().state.updatedAt)
  const pending = computed(() => operations.value > 0)

  async function perform<Result>(source: string, operation: () => Promise<Result>) {
    operations.value++
    try {
      return await operation()
    } catch (error) {
      reportError(error, source)
      throw error
    } finally {
      operations.value--
    }
  }

  function enqueue<Result>(group: string, operation: () => Promise<Result>) {
    const previous = groupQueue.get(group) ?? Promise.resolve()
    const task = previous.catch(() => {}).then(operation)
    groupQueue.set(group, task)
    const release = () => {
      if (groupQueue.get(group) === task)
        groupQueue.delete(group)
    }
    void task.then(release, release)
    return task
  }

  async function load(group: string, state: CacheState, force = false) {
    if (state.initialized && !force)
      return
    const records = await readCache<T>(group)
    state.records = Object.fromEntries(records.map(record => [JSON.stringify(record.id), record]))
    state.initialized = true
    state.updatedAt = Date.now()
  }

  async function read(force = false) {
    const { group, state } = target()
    const selectedId = toValue(id)
    return perform('读取 ' + group + ' 缓存失败', () => enqueue(group, async () => {
      await load(group, state, force)
      return select(state, selectedId)
    }))
  }

  async function write(value: T | T[]) {
    const { group, state } = target()
    return perform('写入 ' + group + ' 缓存失败', () => {
      // 保存调用时的数据快照；列表中的每条记录直接使用后端原有的 id。
      const records: T[] = (Array.isArray(value) ? value : [value])
        .map(record => structuredClone(toRaw(record)))
      for (const record of records) {
        if (!record || (typeof record.id !== 'string' && typeof record.id !== 'number')
          || (typeof record.id === 'number' && !Number.isFinite(record.id)))
          throw new Error('每条缓存数据必须包含有效的字符串或数字 id')
      }
      return enqueue(group, async () => {
        await load(group, state)
        await writeCache(group, records)
        for (const record of records)
          state.records[JSON.stringify(record.id)] = record
        state.updatedAt = Date.now()
      })
    })
  }

  async function remove(recordId?: string | number) {
    const { group, state } = target()
    const selectedId = recordId ?? toValue(id)
    return perform('删除 ' + group + ' 缓存失败', () => {
      if (selectedId == null)
        throw new Error('删除缓存时需要指定数据 id')
      return enqueue(group, async () => {
        await load(group, state)
        await removeCache(group, selectedId)
        Reflect.deleteProperty(state.records, JSON.stringify(selectedId))
        state.updatedAt = Date.now()
      })
    })
  }

  async function clear() {
    const { group, state } = target()
    return perform('清空 ' + group + ' 缓存失败', () => enqueue(group, async () => {
      await clearCache(group)
      state.records = {}
      state.initialized = true
      state.updatedAt = Date.now()
    }))
  }

  function restore() {
    // 自动恢复的错误已由 perform 上报，避免再产生未处理的 Promise 异常。
    void read().catch(() => {})
  }

  onMounted(() => {
    mounted = true
    restore()
  })
  watch(() => JSON.stringify([toValue(folder), toValue(id)]), () => {
    if (mounted)
      restore()
  }, { flush: 'sync' })

  return { data, initialized, updatedAt, pending, read, write, remove, clear }
}
