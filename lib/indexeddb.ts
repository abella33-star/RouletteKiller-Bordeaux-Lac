/**
 * IndexedDB wrapper — SessionStore + SpinStore
 * Falls back to localStorage if IndexedDB unavailable.
 */
import type { Spin, AppState } from './types'

const DB_NAME    = 'RKBordeauxLac'
const DB_VERSION = 1
const STORE_STATE = 'app_state'

let _db: IDBDatabase | null = null

function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db)
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_STATE)) {
        db.createObjectStore(STORE_STATE, { keyPath: 'key' })
      }
    }
    req.onsuccess = (e) => {
      _db = (e.target as IDBOpenDBRequest).result
      resolve(_db)
    }
    req.onerror = () => reject(req.error)
  })
}

function put<T>(store: string, key: string, value: T): Promise<void> {
  return openDB().then(db => new Promise((res, rej) => {
    const tx  = db.transaction(store, 'readwrite')
    const req = tx.objectStore(store).put({ key, value })
    req.onsuccess = () => res()
    req.onerror   = () => rej(req.error)
  }))
}

function get<T>(store: string, key: string): Promise<T | null> {
  return openDB().then(db => new Promise((res, rej) => {
    const tx  = db.transaction(store, 'readonly')
    const req = tx.objectStore(store).get(key)
    req.onsuccess = () => res(req.result?.value ?? null)
    req.onerror   = () => rej(req.error)
  }))
}

// ── Serialisable subset of AppState ─────────────────────────
type PersistedState = Omit<AppState, 'lastEngineResult'>

const KEY = 'rk_state_v2'

export async function saveState(state: AppState): Promise<void> {
  const persisted: PersistedState = {
    spins:           state.spins,
    bankroll:        state.bankroll,
    initialDeposit:  state.initialDeposit,
    startBankroll:   state.startBankroll,
    wins:            state.wins,
    losses:          state.losses,
    totalSpins:      state.totalSpins,
    consecutiveLoss: state.consecutiveLoss,
    victoryShown:    state.victoryShown,
  }
  try {
    await put<PersistedState>(STORE_STATE, KEY, persisted)
  } catch {
    // Fallback
    try { localStorage.setItem(KEY, JSON.stringify(persisted)) } catch {}
  }
}

export async function loadState(): Promise<PersistedState | null> {
  try {
    const v = await get<PersistedState>(STORE_STATE, KEY)
    if (v) return v
  } catch {}
  // Fallback
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return null
}

export async function clearState(): Promise<void> {
  try {
    const db = await openDB()
    await new Promise<void>((res, rej) => {
      const tx  = db.transaction(STORE_STATE, 'readwrite')
      const req = tx.objectStore(STORE_STATE).delete(KEY)
      req.onsuccess = () => res()
      req.onerror   = () => rej(req.error)
    })
  } catch {}
  try { localStorage.removeItem(KEY) } catch {}
}
