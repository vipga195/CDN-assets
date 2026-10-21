
'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { API_URL, COOKIE } from '../lib/api'

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
  revalidatePath('/')
  return null
}

export async function remove(id: string) {
  const headers = await auth()
  if (!headers) return
  await fetch(`${API_URL}/images/${encodeURIComponent(id)}`, { method: 'DELETE', headers, cache: 'no-store' })
  revalidatePath('/')
}