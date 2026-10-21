import type { Metadata } from 'next'

// login/page.tsx is a Client Component, so its title is set here.
export const metadata: Metadata = { title: 'Đăng nhập' }

export default function LoginLayout({ children }: { children: React.ReactNode }): React.ReactElement {
  return <>{children}</>
}
