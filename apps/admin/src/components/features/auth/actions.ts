'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { API_URL, COOKIE } from '@/services/lib/api'

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
    path: '/',
    maxAge: 7 * 24 * 3600, // matches the 7-day session in the API
  })
  redirect('/content')
}

export async function register(_prev: string | null, form: FormData): Promise<string | null> {
  const res = await fetch(`${API_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
    cache: 'no-store',
  })
  if (res.status === 409) return 'Email đã được đăng ký'
  if (!res.ok) return 'Email hợp lệ và mật khẩu 8-72 ký tự'
  return login(null, form)
}

export async function logout() {
  const store = await cookies()
  const token = store.get(COOKIE)?.value
  if (token) {
    try {
      await fetch(`${API_URL}/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
    } catch {
      // API unreachable: still clear the cookie; the session expires on its own.
    }
  }
  store.set(COOKIE, '', { path: '/', maxAge: 0 })
  redirect('/login')
}