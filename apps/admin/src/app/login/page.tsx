'use client'

import { useActionState } from 'react'
import { login } from './actions'

export default function LoginPage() {
  const [error, action, pending] = useActionState(login, null)
  return (
    <form action={action}>
      <h1>Đăng nhập</h1>
      <input name="email" placeholder="email" required />
      <input name="password" type="password" placeholder="mật khẩu" required />
      <button disabled={pending}>Đăng nhập</button>
      {error && <p role="alert">{error}</p>}
    </form>
  )
}