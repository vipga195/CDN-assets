import Link from 'next/link'
import { getMe } from '@/services/lib/api'
import { logout } from '@/components/features/auth/actions'
import Button from '@/components/ui/button'
import TopbarNav, { type NavItem } from './topbar-nav'

export default async function AppTopbar() {
  const me = await getMe()
  const items: NavItem[] = [
    { href: '/content-model', label: 'Content model' },
    { href: '/content', label: 'Content' },
    { href: '/assets', label: 'Media' },
    ...(me?.role === 'admin' ? [{ href: '/users', label: 'Users' }] : []),
    { href: '/docs', label: 'Docs' },
  ]

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
      <div className="flex h-14 w-full items-center gap-4 px-4">
        <Link href="/content" className="flex shrink-0 items-center gap-2" aria-label="imgcdn">
          <span className="h-7 w-7 rounded-lg bg-slate-900" aria-hidden="true" />
        </Link>
        <TopbarNav items={items} />
        <div className="ml-auto flex shrink-0 items-center gap-3">
          <span className="hidden text-sm text-slate-500 lg:inline">{me?.email}</span>
          <form action={logout}>
            <Button variant="secondary" size="sm">Đăng xuất</Button>
          </form>
        </div>
      </div>
    </header>
  )
}
