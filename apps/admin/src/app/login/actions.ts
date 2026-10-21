'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { API_URL, COOKIE } from '../../lib/api'

export async function login(_prev: string | null, form: FormData): Promise<string | null> {
  const res = await fetch(`${API_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
    cache: 'no-store',
  })
  if (res.status === 403) return 'Tài khoản đã bị khoá'
  if (!res.ok) return 'Sai email hoặc mật khẩu'

  const { token } = (await res.json()) as { token: string }
  ;(await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/admin',
    maxAge: 7 * 24 * 3600, // matches the 7-day session in the API
  })
  redirect('/')
}

export async function logout() {
  ;(await cookies()).delete(COOKIE)
  ;(await cookies()).set(COOKIE, '', { path: '/admin', maxAge: 0 })
  redirect('/login')
}