'use client'

import Link from 'next/link'
import { useState } from 'react'
import { entryTitle, type ContentType, type Entry, type Field } from '@/services/cms/types'
import type { Img } from '@/services/lib/api'
import Modal from '@/components/ui/modal'
import Button from '@/components/ui/button'
import Input from '@/components/ui/input'
import Select from '@/components/ui/select'

type Props = {
  field: Field
  value: unknown
  onChange: (v: unknown) => void
  types: ContentType[]
  entries: Entry[]
  images: Img[]
  cdn: string
}

const TEXTAREA = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-[15px] outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10'

export default function FieldInput({ field, value, onChange, types, entries, images, cdn }: Props) {
  const str = typeof value === 'string' ? value : ''

  switch (field.type) {
    case 'text':
      return <Input value={str} onChange={(e) => onChange(e.target.value)} />
    case 'longText':
      return <textarea rows={6} className={TEXTAREA} value={str} onChange={(e) => onChange(e.target.value)} />
    case 'json':
      return <textarea rows={6} className={`${TEXTAREA} font-mono text-sm`} value={str} spellCheck={false} onChange={(e) => onChange(e.target.value)} />
    case 'number':
      return <Input type="number" step="any" value={typeof value === 'number' ? value : ''} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} />
    case 'date':
      return <Input type="datetime-local" value={str} onChange={(e) => onChange(e.target.value)} />
    case 'boolean':
      return (
        <div className="flex gap-6 text-sm">
          {[true, false].map((b) => (
            <label key={String(b)} className="flex items-center gap-2">
              <input type="radio" checked={value === b} onChange={() => onChange(b)} />
              {b ? 'Yes' : 'No'}
            </label>
          ))}
        </div>
      )
    case 'reference': {
      const options = entries.filter((e) => !field.refTypeId || e.typeId === field.refTypeId)
      const picked = typeof value === 'string' ? entries.find((e) => e.id === value) : undefined
      return (
        <div className="space-y-1">
          <Select value={str} onChange={(e) => onChange(e.target.value || null)}>
            <option value="">Chưa chọn</option>
            {options.map((e) => <option key={e.id} value={e.id}>{entryTitle(e, types.find((t) => t.id === e.typeId))}</option>)}
          </Select>
          {picked && <Link href={`/content/${picked.id}`} className="text-xs font-semibold text-blue-700">Mở entry đã liên kết</Link>}
          {str && !picked && <p className="text-xs text-red-600">Entry đã liên kết không còn tồn tại</p>}
        </div>
      )
    }
    case 'media':
      return <MediaInput value={str} onChange={onChange} images={images} cdn={cdn} />
  }
}

function MediaInput({ value, onChange, images, cdn }: { value: string; onChange: (v: unknown) => void; images: Img[]; cdn: string }) {
  const [open, setOpen] = useState(false)
  const picked = images.find((i) => i.id === value)

  return (
    <div className="space-y-2">
      {value ? (
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${cdn}/i/${value}?w=128`} alt="" className="h-16 w-16 rounded-md bg-slate-100 object-cover" />
          <span className="min-w-0 flex-1 truncate text-sm">{picked?.filename ?? value}</span>
          <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)}>Đổi</Button>
          <Button type="button" size="sm" variant="danger" onClick={() => onChange(null)}>Bỏ</Button>
        </div>
      ) : (
        <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)}>Chọn ảnh từ Media</Button>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Chọn ảnh" wide>
        {images.length === 0 ? (
          <p className="text-sm text-slate-500">
            Chưa có ảnh nào. <Link href="/assets" className="font-semibold text-blue-700">Tải ảnh lên ở Media</Link>
          </p>
        ) : (
          <ul className="grid max-h-96 grid-cols-3 gap-3 overflow-y-auto sm:grid-cols-4">
            {images.map((img) => (
              <li key={img.id}>
                <button
                  type="button"
                  onClick={() => { onChange(img.id); setOpen(false) }}
                  className={`block w-full overflow-hidden rounded-lg border-2 text-left ${img.id === value ? 'border-blue-600' : 'border-transparent hover:border-slate-300'}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`${cdn}/i/${img.id}?w=256`} alt={img.filename} className="aspect-square w-full bg-slate-100 object-cover" />
                  <span className="block truncate px-1 py-1 text-xs">{img.filename}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  )
}
