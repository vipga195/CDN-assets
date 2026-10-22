'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { API_URL, COOKIE } from '../../services/lib/api'

// Returns an error message, or null on success.
export async function patchUser(
  id: number,
  patch: { quota_bytes?: number; disabled?: boolean },
): Promise<string | null> {
  const token = (await cookies()).get(COOKIE)?.value
  if (!token) return 'Chưa đăng nhập'
  const res = await fetch(`${API_URL}/admin/users/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
    cache: 'no-store',
  })
  if (!res.ok) {
    const msg = (await res.json().catch(() => null))?.error
    return msg ?? `Lỗi (${res.status})`
  }
  revalidatePath('/users')
  return null
}