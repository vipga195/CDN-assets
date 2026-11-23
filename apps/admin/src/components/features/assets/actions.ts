
'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { API_URL, COOKIE } from '@/services/lib/api'

async function auth() {
  const token = (await cookies()).get(COOKIE)?.value
  return token ? { Authorization: `Bearer ${token}` } : null
}

export async function upload(_prev: string | null, form: FormData): Promise<string | null> {
  const headers = await auth()
  if (!headers) return 'Chưa đăng nhập'
  const file = form.get('file')
  if (!(file instanceof File) || file.size === 0) return 'Chọn một ảnh'

  const body = new FormData()
  body.set('file', file)
  const res = await fetch(`${API_URL}/upload`, { method: 'POST', headers, body, cache: 'no-store' })
  if (!res.ok) {
    const msg = (await res.json().catch(() => null))?.error
    return msg ?? `Upload lỗi (${res.status})`
  }
  revalidatePath('/assets')
  return null
}

// Returns an error message, or null on success (an already-deleted image counts as success).
export async function remove(id: string): Promise<string | null> {
  const headers = await auth()
  if (!headers) return 'Chưa đăng nhập'
  try {
    const res = await fetch(`${API_URL}/images/${encodeURIComponent(id)}`, { method: 'DELETE', headers, cache: 'no-store' })
    if (!res.ok && res.status !== 404) return `Xoá lỗi (${res.status})`
  } catch {
    return 'Không kết nối được máy chủ'
  }
  revalidatePath('/assets')
  return null
}
