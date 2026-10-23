import type { Metadata } from 'next'
import LoginForm from '@/components/features/auth/login-form'

export const metadata: Metadata = { title: 'Đăng nhập' }

export default function LoginPage() {
  return <LoginForm />
}
