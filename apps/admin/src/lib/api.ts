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

// Returns an empty list when there is no cookie or the API call fails.
export async function getImages(): Promise<Img[]> {
  const token = (await cookies()).get(COOKIE)?.value
  if (!token) return []
  try {
    const res = await fetch(`${API_URL}/images`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    return res.ok ? ((await res.json()) as Img[]) : []
  } catch {
    return []
  }
}

// Returns null when there is no cookie or the API call fails.
export async function getUsers(): Promise<AdminUser[] | null> {
  const token = (await cookies()).get(COOKIE)?.value
  if (!token) return null
  try {
    const res = await fetch(`${API_URL}/admin/users`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    return res.ok ? ((await res.json()) as AdminUser[]) : null
  } catch {
    return null
  }
}
