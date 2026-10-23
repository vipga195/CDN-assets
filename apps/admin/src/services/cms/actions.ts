'use server'

import { cookies } from 'next/headers'
import { API_URL, COOKIE } from '@/services/lib/api'
import type { ContentType, Entry, Res } from './types'

const PAGE = 100
const MAX_PAGES = 50

type Raw = { kind: 'ok'; json: unknown } | { kind: 'err'; error: string }

async function call(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<Raw> {
  const token = (await cookies()).get(COOKIE)?.value
  if (!token) return { kind: 'err', error: 'Chưa đăng nhập' }
  const hasBody = method === 'POST' || method === 'PUT'
  try {
    const res = await fetch(`${API_URL}/cms${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      // POST must carry a body: the API answers 400 to a POST without Content-Length.
      body: hasBody ? JSON.stringify(body ?? {}) : undefined,
      cache: 'no-store',
    })
    if (!res.ok) {
      const msg = (await res.json().catch(() => null))?.error
      return { kind: 'err', error: typeof msg === 'string' ? msg : `Lỗi (${res.status})` }
    }
    return { kind: 'ok', json: res.status === 204 ? null : await res.json() }
  } catch {
    return { kind: 'err', error: 'Không kết nối được API' }
  }
}

// Empty strings (a cleared date or number input) mean "no value" for the API.
function clean(values: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(values).filter(([, v]) => v !== ''))
}

export async function loadCms(): Promise<Res<{ types: ContentType[]; entries: Entry[] }>> {
  const t = await call('GET', '/content-types')
  if (t.kind === 'err') return t

  const entries: Entry[] = []
  let cursor = ''
  for (let i = 0; i < MAX_PAGES; i++) {
    const r = await call('GET', `/entries?limit=${PAGE}${cursor}`)
    if (r.kind === 'err') return r
    // The API returns the shape declared in types.ts.
    const page = r.json as Entry[]
    entries.push(...page)
    if (page.length < PAGE) break
    const last = page[page.length - 1]
    cursor = `&before_updated=${encodeURIComponent(last.updatedAt)}&before_id=${last.id}`
  }
  return { kind: 'ok', data: { types: t.json as ContentType[], entries } }
}

export async function saveType(t: ContentType, isNew: boolean): Promise<Res<ContentType>> {
  const body = { id: t.id, name: t.name, description: t.description, displayFieldId: t.displayFieldId, fields: t.fields }
  const r = isNew
    ? await call('POST', '/content-types', body)
    : await call('PUT', `/content-types/${encodeURIComponent(t.id)}`, body)
  return r.kind === 'ok' ? { kind: 'ok', data: r.json as ContentType } : r
}

export async function deleteType(id: string): Promise<Res<null>> {
  const r = await call('DELETE', `/content-types/${encodeURIComponent(id)}`)
  if (r.kind === 'err' && r.error === 'delete its entries first') {
    return { kind: 'err', error: 'Hãy xoá hết entry của content type này trước' }
  }
  return r.kind === 'ok' ? { kind: 'ok', data: null } : r
}

export async function saveEntry(e: Entry, isNew: boolean): Promise<Res<Entry>> {
  const r = isNew
    ? await call('POST', '/entries', { typeId: e.typeId, values: clean(e.values) })
    : await call('PUT', `/entries/${e.id}`, { values: clean(e.values), version: e.version })
  return r.kind === 'ok' ? { kind: 'ok', data: r.json as Entry } : r
}

export async function publishEntry(id: string, version: number): Promise<Res<Entry>> {
  const r = await call('POST', `/entries/${id}/publish`, { version })
  return r.kind === 'ok' ? { kind: 'ok', data: r.json as Entry } : r
}

export async function unpublishEntry(id: string): Promise<Res<Entry>> {
  const r = await call('POST', `/entries/${id}/unpublish`)
  return r.kind === 'ok' ? { kind: 'ok', data: r.json as Entry } : r
}

export async function deleteEntry(id: string): Promise<Res<null>> {
  const r = await call('DELETE', `/entries/${id}`)
  return r.kind === 'ok' ? { kind: 'ok', data: null } : r
}
