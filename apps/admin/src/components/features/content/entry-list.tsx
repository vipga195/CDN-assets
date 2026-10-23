'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useCms } from '@/services/cms/store'
import { entryStatus, entryTitle, type EntryStatus } from '@/services/cms/types'
import SideNav from '@/components/layout/side-nav'
import StatusBadge from '@/components/ui/status-badge'
import Card from '@/components/ui/card'
import Input from '@/components/ui/input'
import Alert from '@/components/ui/alert'

type Props = { type?: string; status?: EntryStatus; q: string }

const TH = 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500'
const STATUSES: { value: EntryStatus; label: string }[] = [
  { value: 'published', label: 'Published' },
  { value: 'changed', label: 'Changed' },
  { value: 'draft', label: 'Draft' },
]

function href(p: { type?: string; status?: string; q?: string }) {
  const sp = new URLSearchParams()
  if (p.type) sp.set('type', p.type)
  if (p.status) sp.set('status', p.status)
  if (p.q) sp.set('q', p.q)
  const s = sp.toString()
  return s ? `/content?${s}` : '/content'
}

export default function EntryList({ type, status, q }: Props) {
  const router = useRouter()
  const { types, entries, ready, error } = useCms()
  const typeById = useMemo(() => new Map(types.map((t) => [t.id, t])), [types])

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return entries
      .filter((e) => (!type || e.typeId === type) && (!status || entryStatus(e) === status))
      .filter((e) => !needle || entryTitle(e, typeById.get(e.typeId)).toLowerCase().includes(needle))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [entries, type, status, q, typeById])

  const sections = [
    { items: [{ href: '/content', label: 'All entries', active: !type && !status, count: entries.length }] },
    {
      title: 'Status',
      items: STATUSES.map((s) => ({
        href: href({ status: s.value }),
        label: s.label,
        active: status === s.value && !type,
        count: entries.filter((e) => entryStatus(e) === s.value).length,
      })),
    },
    {
      title: 'Content type',
      items: types.map((t) => ({ href: href({ type: t.id }), label: t.name, active: type === t.id, count: entries.filter((e) => e.typeId === t.id).length })),
    },
  ]

  return (
    <div className="flex flex-col gap-6 md:flex-row">
      <SideNav sections={sections} />

      <div className="min-w-0 flex-1 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Content</h1>
          <details className="relative">
            <summary className="cursor-pointer list-none rounded-full bg-blue-600 px-5 py-2.5 text-[15px] font-semibold text-white hover:bg-blue-700">
              Add entry ▾
            </summary>
            <ul className="absolute right-0 z-30 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
              {types.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">Hãy tạo content type trước</li>}
              {types.map((t) => (
                <li key={t.id}>
                  <Link href={`/content/new?type=${t.id}`} className="block rounded-lg px-3 py-2 text-sm font-medium hover:bg-slate-100">{t.name}</Link>
                </li>
              ))}
            </ul>
          </details>
        </div>

        <form action="/content" method="get" role="search">
          {type && <input type="hidden" name="type" value={type} />}
          {status && <input type="hidden" name="status" value={status} />}
          <Input type="search" name="q" defaultValue={q} placeholder="Tìm entry theo tên" className="max-w-md" />
        </form>

        {error && <Alert>{error}</Alert>}

        {ready && rows.length === 0 ? (
          <Card className="p-10 text-center text-slate-500">Không có entry nào.</Card>
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr><th className={TH}>Name</th><th className={TH}>Content type</th><th className={TH}>Updated</th><th className={TH}>Status</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((e) => {
                  const t = typeById.get(e.typeId)
                  return (
                    <tr key={e.id} className="cursor-pointer hover:bg-slate-50" onClick={() => router.push(`/content/${e.id}`)}>
                      <td className="px-4 py-3 font-semibold">
                        <Link href={`/content/${e.id}`} className="text-blue-700 hover:underline" onClick={(ev) => ev.stopPropagation()}>{entryTitle(e, t)}</Link>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{t?.name ?? e.typeId}</td>
                      <td className="px-4 py-3 text-slate-600">{new Date(e.updatedAt).toLocaleString('vi-VN')}</td>
                      <td className="px-4 py-3"><StatusBadge status={entryStatus(e)} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  )
}
