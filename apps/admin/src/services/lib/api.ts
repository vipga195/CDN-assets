import { cookies } from 'next/headers'

// Internal API base; defaults to the nginx entry used in dev.
export const API_URL = process.env.API_URL ?? 'http://localhost:8090'
export const COOKIE = 'imgcdn_session'

export type Me = {
  email: string
  quota_bytes: number
  used_bytes: number
  role: 'user' | 'admin'
}

// Returns null when there is no cookie, the API rejects the token or the call fails.
export async function getMe(): Promise<Me | null> {
  const token = (await cookies()).get(COOKIE)?.value
  if (!token) return null
  try {
    const res = await fetch(`${API_URL}/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    return res.ok ? ((await res.json()) as Me) : null
  } catch {
    return null
  }
}

export const CDN_URL = process.env.NEXT_PUBLIC_CDN_URL ?? 'http://localhost:8090'

export type Img = {
  id: string
  filename: string
  size_bytes: number
  width: number
  height: number
  created_at: string
}

export type AdminUser = {
  id: number
  email: string
  role: 'user' | 'admin'
  disabled: boolean
  quota_bytes: number
  used_bytes: number
  created_at: string
}

export const PAGE_SIZE = 20

// Returns an empty page when there is no cookie or the API call fails.
export async function getImages(
  cursor?: { created: string; id: string },
): Promise<{ items: Img[]; total: number }> {
  const token = (await cookies()).get(COOKIE)?.value
  if (!token) return { items: [], total: 0 }
  const q = new URLSearchParams({ limit: String(PAGE_SIZE) })
  if (cursor) {
    q.set('before_created', cursor.created)
    q.set('before_id', cursor.id)
  }
  try {
    const res = await fetch(`${API_URL}/images?${q}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return { items: [], total: 0 }
    return {
      items: (await res.json()) as Img[],
      total: Number(res.headers.get('X-Total-Count') ?? 0),
    }
  } catch {
    return { items: [], total: 0 }
  }
}

// Returns null when there is no cookie or the API call fails.
export async function getUsers(
  afterId?: string,
): Promise<{ items: AdminUser[]; total: number } | null> {
  const token = (await cookies()).get(COOKIE)?.value
  if (!token) return null
  const q = new URLSearchParams({ limit: String(PAGE_SIZE) })
  if (afterId) q.set('after_id', afterId)
  try {
    const res = await fetch(`${API_URL}/admin/users?${q}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return null
    return {
      items: (await res.json()) as AdminUser[],
      total: Number(res.headers.get('X-Total-Count') ?? 0),
    }
  } catch {
    return null
  }
}
