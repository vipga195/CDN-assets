'use client'

import { useSyncExternalStore } from 'react'
import * as api from './actions'
import type { ContentType, Entry, Res } from './types'

// Client cache of the CMS API (through Server Actions, the session cookie is HttpOnly).
// The cache lives only while a component uses it: the last unsubscribe clears it, so the next
// page load fetches fresh data (and another user never sees stale content after re-login).
type State = { types: ContentType[]; entries: Entry[]; ready: boolean; error: string | null }

const EMPTY: State = { types: [], entries: [], ready: false, error: null }
let state: State = EMPTY
let gen = 0 // bumped on every refresh and reset; a response from an older generation is dropped
const listeners = new Set<() => void>()

function set(next: Partial<State>): void {
  state = { ...state, ...next }
  listeners.forEach((l) => l())
}

async function refresh(): Promise<void> {
  const g = ++gen
  const res = await api.loadCms()
  if (g !== gen) return
  if (res.kind === 'ok') set({ ...res.data, ready: true, error: null })
  else set({ ready: true, error: res.error })
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  if (listeners.size === 1) void refresh()
  return () => {
    listeners.delete(cb)
    if (listeners.size === 0) {
      gen++
      state = EMPTY
    }
  }
}

function getSnapshot(): State {
  return state
}

export function useCms(): State {
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY)
}

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  return list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item]
}

// Applies a successful entry response to the cache and passes the result through.
function keepEntry(res: Res<Entry>): Res<Entry> {
  if (res.kind === 'ok') set({ entries: upsert(state.entries, res.data) })
  return res
}

export const cms = {
  // Returns an error message, or null on success.
  async saveType(t: ContentType, isNew: boolean): Promise<string | null> {
    const res = await api.saveType(t, isNew)
    if (res.kind === 'err') return res.error
    set({ types: upsert(state.types, res.data) })
    return null
  },
  async deleteType(id: string): Promise<string | null> {
    const res = await api.deleteType(id)
    if (res.kind === 'err') return res.error
    set({ types: state.types.filter((t) => t.id !== id) })
    return null
  },
  // `isNew` entries get their id from the API, so the returned entry carries the real id.
  async saveEntry(e: Entry, isNew: boolean): Promise<Res<Entry>> {
    return keepEntry(await api.saveEntry(e, isNew))
  },
  async publishEntry(e: Entry): Promise<Res<Entry>> {
    return keepEntry(await api.publishEntry(e.id, e.version))
  },
  async unpublishEntry(id: string): Promise<Res<Entry>> {
    return keepEntry(await api.unpublishEntry(id))
  },
  async deleteEntry(id: string): Promise<string | null> {
    const res = await api.deleteEntry(id)
    if (res.kind === 'err') return res.error
    set({ entries: state.entries.filter((x) => x.id !== id) })
    return null
  },
}
