'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { login } from './actions'
import Button from '@/components/ui/button'
import Input from '@/components/ui/input'
import Alert from '@/components/ui/alert'

export default function LoginForm() {
  const [error, action, pending] = useActionState(login, null)
  return (
    <form action={action} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-8">
      <h1 className="text-2xl font-bold">Đăng nhập</h1>
      <Input name="email" type="email" placeholder="Email" autoComplete="email" required />
      <Input name="password" type="password" placeholder="Mật khẩu" autoComplete="current-password" required />
      {error && <Alert>{error}</Alert>}
      <Button disabled={pending} className="w-full">{pending ? 'Đang đăng nhập...' : 'Đăng nhập'}</Button>
      <p className="text-center text-sm text-slate-500">
        Chưa có tài khoản? <Link href="/register" className="font-semibold text-slate-900">Đăng ký</Link>
      </p>
    </form>
  )
}
