import Link from 'next/link'

export type SideItem = { href: string; label: string; active: boolean; count?: number }
export type SideSection = { title?: string; items: SideItem[] }

export default function SideNav({ sections }: { sections: SideSection[] }) {
  return (
    <aside className="w-full shrink-0 space-y-5 md:w-60">
      {sections.map((s, i) => (
        <div key={s.title ?? i}>
          {s.title && <h2 className="mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{s.title}</h2>}
          <ul>
            {s.items.map((it) => (
              <li key={it.href}>
                <Link
                  href={it.href}
                  aria-current={it.active ? 'page' : undefined}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium ${
                    it.active ? 'bg-slate-200 text-slate-900' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="truncate">{it.label}</span>
                  {it.count !== undefined && <span className="text-xs text-slate-500">{it.count}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </aside>
  )
}
