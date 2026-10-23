'use client'

import { useState, useTransition } from 'react'
import { remove } from './actions'
import type { Img } from '@/services/lib/api'
import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import LinkDialog from './link-dialog'

export default function ImageCard({ img, cdn }: { img: Img; cdn: string }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  return (
    <li>
      <Card className="flex h-full flex-col overflow-hidden">
        <div className="aspect-square bg-slate-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${cdn}/i/${img.id}?w=256`} alt={img.filename} className="h-full w-full object-cover" />
        </div>
        <div className="flex flex-1 flex-col gap-3 p-4">
          <div>
            <p className="truncate text-sm font-semibold" title={img.filename}>{img.filename}</p>
            <p className="text-xs text-slate-500">{img.width}x{img.height} · {Math.round(img.size_bytes / 1024)} KB</p>
          </div>
          {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
          <div className="mt-auto flex gap-2">
            <div className="flex-1"><LinkDialog img={img} cdn={cdn} /></div>
            <Button size="sm" variant="danger" disabled={pending} onClick={() => start(async () => setError(await remove(img.id)))}>Xoá</Button>
          </div>
        </div>
      </Card>
    </li>
  )
}
