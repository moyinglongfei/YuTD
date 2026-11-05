export interface CacheRecord {
  id: string | number
}

const databases = new Map<string, Promise<IDBDatabase>>()

function openDatabase(folder: string) {
  let database = databases.get(folder)
  if (!database) {
    database = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('当前环境不支持 IndexedDB'))
        return
      }
      let blocked = false
      const request = indexedDB.open('yutd-' + folder, 1)
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore(folder, { keyPath: 'id' })
        if (folder === 'tasks' || folder === 'events')
          store.createIndex('phaseId', 'phaseId', { unique: false })
      }
      request.onerror = () => reject(request.error ?? new Error('打开缓存失败'))
      request.onblocked = () => {
        blocked = true
        reject(new Error('缓存数据库被其他页面阻塞'))
      }
      request.onsuccess = () => {
        const db = request.result
        if (blocked) {
          db.close()
          return
        }
        db.onversionchange = () => {
          db.close()
          databases.delete(folder)
        }
        resolve(db)
      }
    }).catch((error) => {
      databases.delete(folder)
      throw error
    })
    databases.set(folder, database)
  }
  return database
}

async function transaction<T>(
  folder: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T> | undefined
) {
  const db = await openDatabase(folder)
  return new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(folder, mode)
    let request: IDBRequest<T> | undefined
    // 请求成功不代表事务已提交，提交完成后再更新页面中的缓存。
    tx.oncomplete = () => resolve(request?.result)
    tx.onabort = () => reject(tx.error ?? new Error('缓存事务已中止'))
    tx.onerror = () => reject(tx.error ?? new Error('缓存事务失败'))
    try {
      request = operation(tx.objectStore(folder))
    } catch (error) {
      tx.abort()
      reject(error)
    }
  })
}

export async function readCache<T extends CacheRecord>(folder: string): Promise<T[]> {
  return await transaction<T[]>(folder, 'readonly', store => store.getAll()) ?? []
}

export async function writeCache<T extends CacheRecord>(folder: string, records: T[]) {
  await transaction(folder, 'readwrite', (store) => {
    // 同一批数据在一个事务内逐条写入，任意一条失败则整批回滚。
    for (const record of records)
      store.put(record)
    return undefined
  })
}

export async function removeCache(folder: string, id: string | number) {
  await transaction(folder, 'readwrite', store => store.delete(id))
}

export async function clearCache(folder: string) {
  await transaction(folder, 'readwrite', store => store.clear())
}
