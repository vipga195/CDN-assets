'use client'

import { useActionState, useRef } from 'react'
import { changePassword } from './actions'
import Button from '@/components/ui/button'
import Input from '@/components/ui/input'
import Alert from '@/components/ui/alert'

export default function ChangePasswordForm() {
  const ref = useRef<HTMLFormElement>(null)
  const [error, action, pending] = useActionState(async (prev: string | null, form: FormData) => {
    const err = await changePassword(prev, form)
    if (!err) ref.current?.reset()
    return err
  }, null)
  return (
    <form ref={ref} action={action} className="max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-8">
      <h1 className="text-2xl font-bold">Đổi mật khẩu</h1>
      <Input name="current_password" type="password" placeholder="Mật khẩu hiện tại" autoComplete="current-password" required />
      <Input name="new_password" type="password" placeholder="Mật khẩu mới (8-72 ký tự)" autoComplete="new-password" minLength={8} required />
      {error && <Alert>{error}</Alert>}
      <Button disabled={pending} className="w-full">{pending ? 'Đang lưu...' : 'Đổi mật khẩu'}</Button>
    </form>
  )
}
