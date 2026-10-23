'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export type NavItem = { href: string; label: string }

export default function TopbarNav({ items }: { items: NavItem[] }) {
  const path = usePathname()
  return (
    <nav className="flex min-w-0 items-center gap-1 overflow-x-auto" aria-label="Chính">
      {items.map((it) => {
        const active = path === it.href || path.startsWith(`${it.href}/`)
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? 'page' : undefined}
            className={`whitespace-nowrap rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors ${
              active ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-transparent text-slate-600 hover:bg-slate-100'
            }`}
          >
            {it.label}
          </Link>
        )
      })}
    </nav>
  )
}
