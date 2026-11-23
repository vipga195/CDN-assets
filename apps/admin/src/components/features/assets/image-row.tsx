'use client'

import { useState, useTransition } from 'react'
import { remove } from './actions'
import type { Img } from '@/services/lib/api'
import Button from '@/components/ui/button'
import LinkDialog from './link-dialog'

export default function ImageRow({ img, cdn, checked, onToggle }: { img: Img; cdn: string; checked: boolean; onToggle: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  return (
    <tr className={checked ? 'bg-slate-50' : 'hover:bg-slate-50'}>
      <td className="px-4 py-3">
        <input type="checkbox" aria-label={`Chọn ${img.filename}`} checked={checked} onChange={onToggle} />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${cdn}/i/${img.id}?w=64`} alt="" width={48} height={48} className="h-12 w-12 rounded-lg bg-slate-100 object-cover" />
          <span className="max-w-xs truncate font-medium" title={img.filename}>{img.filename}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-slate-600">{img.width}x{img.height}</td>
      <td className="px-4 py-3 text-slate-600">{img.filename.split('.').pop()?.toUpperCase()}</td>
      <td className="px-4 py-3 text-slate-600">{Math.round(img.size_bytes / 1024)} KB</td>
      <td className="px-4 py-3 text-slate-600">{new Date(img.created_at).toLocaleDateString('vi-VN')}</td>
      <td className="px-4 py-3"><LinkDialog img={img} cdn={cdn} /></td>
      <td className="px-4 py-3">
        {error && <p role="alert" className="mb-1 text-right text-xs text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="danger" disabled={pending} onClick={() => start(async () => setError(await remove(img.id)))}>Xoá</Button>
        </div>
      </td>
    </tr>
  )
}
