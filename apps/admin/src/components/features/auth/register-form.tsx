'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { register } from './actions'
import Button from '@/components/ui/button'
import Input from '@/components/ui/input'
import Alert from '@/components/ui/alert'

export default function RegisterForm() {
  const [error, action, pending] = useActionState(register, null)
  return (
    <form action={action} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-8">
      <h1 className="text-2xl font-bold">Đăng ký</h1>
      <Input name="email" type="email" placeholder="Email" autoComplete="email" required />
      <Input name="password" type="password" placeholder="Mật khẩu (8-72 ký tự)" autoComplete="new-password" minLength={8} maxLength={72} required />
      {error && <Alert>{error}</Alert>}
      <Button disabled={pending} className="w-full">{pending ? 'Đang tạo tài khoản...' : 'Tạo tài khoản'}</Button>
      <p className="text-center text-sm text-slate-500">
        Đã có tài khoản? <Link href="/login" className="font-semibold text-slate-900">Đăng nhập</Link>
      </p>
    </form>
  )
}
