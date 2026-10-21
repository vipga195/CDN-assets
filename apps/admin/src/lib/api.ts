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

// Returns null when there is no cookie or the API rejects the token.
export async function getMe(): Promise<Me | null> {
  const token = (await cookies()).get(COOKIE)?.value
  if (!token) return null
  const res = await fetch(`${API_URL}/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  return res.ok ? ((await res.json()) as Me) : null
}