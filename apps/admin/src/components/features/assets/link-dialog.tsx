'use client'

import { useRef, useState } from 'react'
import type { Img } from '@/services/lib/api'
import Button from '@/components/ui/button'
import Input from '@/components/ui/input'

const FITS = ['scale', 'crop', 'pad'] as const
const FORMATS = ['', 'avif', 'webp', 'orig'] // '' = follow the viewer's Accept
const MAX_SIDE = 4000 // keep in sync with the API limit for w/h

// Returns the integer in [min, max], null when empty, NaN when invalid.
function parse(v: string, min: number, max: number): number | null {
  if (v.trim() === '') return null
  const n = Number(v)
  return Number.isInteger(n) && n >= min && n <= max ? n : NaN
}

export default function LinkDialog({ img, cdn }: { img: Img; cdn: string }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  const [w, setW] = useState('512')
  const [h, setH] = useState('')
  const [q, setQ] = useState('')
  const [fit, setFit] = useState<(typeof FITS)[number]>('scale')
  const [fm, setFm] = useState('')
  const [copied, setCopied] = useState(false)

  const wn = parse(w, 1, MAX_SIDE)
  const hn = parse(h, 1, MAX_SIDE)
  const qn = parse(q, 1, 100)
  const invalid = [wn, hn, qn].some(Number.isNaN)

  const params = new URLSearchParams()
  if (wn) params.set('w', String(wn))
  if (hn) params.set('h', String(hn))
  if (wn && hn) params.set('fit', fit)
  if (qn) params.set('q', String(qn))
  if (fm) params.set('fm', fm)
  const qs = params.toString()
  const link = `${cdn}/i/${img.id}${qs ? `?${qs}` : ''}`

  async function copy() {
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function openDialog() {
    setOpen(true)
    ref.current?.showModal()
  }

  const label = 'block space-y-1 text-xs font-semibold text-slate-500'
  const field = (v: string, set: (s: string) => void, ph: string, bad: boolean) => (
    <Input inputMode="numeric" value={v} placeholder={ph} aria-invalid={bad} onChange={(e) => set(e.target.value)} className={bad ? 'border-red-400' : ''} />
  )

  return (
    <>
      <Button size="sm" variant="secondary" type="button" onClick={openDialog}>Tạo link</Button>
      <dialog
        ref={ref}
        onClose={() => setOpen(false)}
        className="m-auto w-full max-w-lg rounded-2xl p-0 backdrop:bg-slate-900/40"
      >
        <div className="space-y-4 p-6">
          <div className="flex items-start justify-between gap-4">
            <h3 className="truncate text-lg font-bold" title={img.filename}>{img.filename}</h3>
            <button type="button" aria-label="Đóng" onClick={() => ref.current?.close()} className="text-slate-500 hover:text-slate-900">✕</button>
          </div>

          {open && (
            <div className="flex h-48 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {!invalid && <img src={link} alt="" className="max-h-full max-w-full object-contain" />}
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <label className={label}>Width (px){field(w, setW, 'auto', Number.isNaN(wn))}</label>
            <label className={label}>Height (px){field(h, setH, 'auto', Number.isNaN(hn))}</label>
            <label className={label}>Quality (1-100){field(q, setQ, 'mặc định', Number.isNaN(qn))}</label>
            <label className={label}>
              Fit
              <select value={fit} disabled={!(wn && hn)} onChange={(e) => setFit(e.target.value as typeof fit)} className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2.5 text-sm disabled:opacity-50">
                {FITS.map((x) => <option key={x}>{x}</option>)}
              </select>
            </label>
            <label className={label}>
              Format
              <select value={fm} onChange={(e) => setFm(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2.5 text-sm">
                {FORMATS.map((x) => <option key={x} value={x}>{x || 'auto'}</option>)}
              </select>
            </label>
          </div>
          <p className="text-xs text-slate-500">
            Width/Height 1-{MAX_SIDE}. Fit chỉ áp dụng khi nhập cả hai.
            {wn && hn && fit === 'scale' && <span className="text-amber-600"> Scale ép ảnh về đúng kích thước nên có thể làm méo ảnh; dùng crop hoặc pad để giữ tỷ lệ.</span>}
          </p>

          <div className="flex items-center gap-2">
            <input readOnly value={invalid ? '' : link} aria-label="Link ảnh" className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs" onFocus={(e) => e.target.select()} />
            <Button size="sm" type="button" disabled={invalid} onClick={copy}>{copied ? 'Đã copy' : 'Copy'}</Button>
          </div>
        </div>
      </dialog>
    </>
  )
}
