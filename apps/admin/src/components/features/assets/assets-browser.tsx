'use client'

import { useMemo, useState, useTransition } from 'react'
import { remove } from './actions'
import ImageCard from './image-card'
import ImageRow from './image-row'
import type { Img } from '@/services/lib/api'
import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import Input from '@/components/ui/input'

const TH = 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500'

export default function AssetsBrowser({ images, cdn, view }: { images: Img[]; cdn: string; view: 'list' | 'grid' }) {
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const shown = useMemo(
    () => images.filter((i) => i.filename.toLowerCase().includes(q.trim().toLowerCase())),
    [images, q],
  )
  const allChecked = shown.length > 0 && shown.every((i) => selected.has(i.id))

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected(allChecked ? new Set() : new Set(shown.map((i) => i.id)))
  }

  function removeSelected() {
    if (!confirm(`Xoá ${selected.size} ảnh đã chọn?`)) return
    setError(null)
    start(async () => {
      const failed = new Set<string>()
      for (const id of selected) if (await remove(id)) failed.add(id)
      setSelected(failed)
      if (failed.size) setError(`Xoá thất bại ${failed.size} ảnh, các ảnh đó vẫn đang được chọn.`)
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="search"
          className="max-w-md"
          placeholder="Tìm theo tên ảnh (trong trang này)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {selected.size > 0 && view === 'list' && (
          <>
            <span className="text-sm text-slate-500">Đã chọn {selected.size}</span>
            <Button size="sm" variant="danger" disabled={pending} onClick={removeSelected}>
              {pending ? 'Đang xoá...' : 'Xoá đã chọn'}
            </Button>
          </>
        )}
      </div>

      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {shown.length === 0 ? (
        <Card className="p-10 text-center text-slate-500">Không có ảnh phù hợp.</Card>
      ) : view === 'grid' ? (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((img) => <ImageCard key={img.id} img={img} cdn={cdn} />)}
        </ul>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input type="checkbox" aria-label="Chọn tất cả" checked={allChecked} onChange={toggleAll} />
                </th>
                {['Tên', 'Kích thước', 'Loại', 'Dung lượng', 'Cập nhật', 'Link', ''].map((h) => (
                  <th key={h} className={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.map((img) => (
                <ImageRow key={img.id} img={img} cdn={cdn} checked={selected.has(img.id)} onToggle={() => toggle(img.id)} />
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
