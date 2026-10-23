'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { cms, useCms } from '@/services/cms/store'
import { entryStatus, entryTitle, isEmptyValue, type Entry } from '@/services/cms/types'
import type { Img } from '@/services/lib/api'
import FieldInput from './field-input'
import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import StatusBadge from '@/components/ui/status-badge'
import Alert from '@/components/ui/alert'

type Props = { entryId: string; newTypeId?: string; images: Img[]; cdn: string }

export default function EntryEditor({ entryId, newTypeId, images, cdn }: Props) {
  const router = useRouter()
  const { types, entries, ready } = useCms()
  const isNew = entryId === 'new'
  const [draft, setDraft] = useState<Entry | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Initialise once; later store updates (save, publish) must not overwrite unsaved edits.
  useEffect(() => {
    if (!ready || draft) return
    if (isNew) {
      if (newTypeId && types.some((t) => t.id === newTypeId)) {
        setDraft({ id: crypto.randomUUID(), typeId: newTypeId, values: {}, version: 0, updatedAt: '', publishedAt: null })
      }
    } else {
      const e = entries.find((x) => x.id === entryId)
      if (e) setDraft(e)
    }
  }, [ready, draft, isNew, newTypeId, types, entries, entryId])

  if (!ready) return <p className="text-slate-500">Đang tải...</p>
  const type = types.find((t) => t.id === draft?.typeId)
  if (!draft || !type) {
    return (
      <Card className="p-10 text-center text-slate-500">
        Không tìm thấy entry. <Link href="/content" className="font-semibold text-blue-700">Về danh sách</Link>
      </Card>
    )
  }

  const d = draft
  const stored = entries.find((e) => e.id === d.id)
  const status = stored ? entryStatus(stored) : 'draft'

  function validate(forPublish: boolean): boolean {
    const next: Record<string, string> = {}
    for (const f of type!.fields) {
      const v = d.values[f.id]
      if (forPublish && f.required && f.type !== 'boolean' && isEmptyValue(v)) next[f.id] = 'Trường bắt buộc'
      if (f.type === 'json' && typeof v === 'string' && v.trim()) {
        try { JSON.parse(v) } catch { next[f.id] = 'JSON không hợp lệ' }
      }
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function save(publish: boolean): Promise<void> {
    setMessage(null)
    setServerError(null)
    if (!validate(publish)) return
    setBusy(true)
    // An entry not in the store yet has no server record, so it is created.
    const saved = await cms.saveEntry(d, !stored)
    if (saved.kind === 'err') {
      setBusy(false)
      return setServerError(saved.error)
    }
    setDraft(saved.data)
    let current = saved.data
    if (publish) {
      const pub = await cms.publishEntry(current)
      if (pub.kind === 'err') {
        setBusy(false)
        return setServerError(pub.error)
      }
      current = pub.data
      setDraft(current)
    }
    setBusy(false)
    setMessage(publish ? 'Đã publish' : 'Đã lưu')
    if (!stored) router.replace(`/content/${current.id}`)
  }

  async function unpublish(): Promise<void> {
    setMessage(null)
    setServerError(null)
    setBusy(true)
    const res = await cms.unpublishEntry(d.id)
    setBusy(false)
    if (res.kind === 'ok') setMessage('Đã unpublish')
    else setServerError(res.error)
  }

  async function remove(): Promise<void> {
    if (!confirm('Xoá entry này?')) return
    setServerError(null)
    setBusy(true)
    const err = await cms.deleteEntry(d.id)
    setBusy(false)
    if (err) setServerError(err)
    else router.push('/content')
  }

  return (
    <div className="space-y-4">
      <div>
        <Link href={`/content?type=${type.id}`} className="text-sm font-semibold text-blue-700">← {type.name}</Link>
        <h1 className="text-2xl font-bold">{entryTitle(d, type)}</h1>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <Card className="min-w-0 flex-1 space-y-6 p-6">
          {type.fields.map((f) => (
            <div key={f.id} className="space-y-1.5">
              <label className="flex items-baseline gap-2 text-sm font-semibold">
                {f.name}
                {f.required && <span className="text-xs font-medium text-slate-500">(required)</span>}
              </label>
              <FieldInput
                field={f}
                value={d.values[f.id]}
                onChange={(v) => { setDraft({ ...d, values: { ...d.values, [f.id]: v } }); setMessage(null) }}
                types={types}
                entries={entries.filter((e) => e.id !== d.id)}
                images={images}
                cdn={cdn}
              />
              {errors[f.id] && <p role="alert" className="text-xs text-red-600">{errors[f.id]}</p>}
            </div>
          ))}
        </Card>

        <aside className="w-full shrink-0 space-y-3 lg:w-72">
          <Card className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-500">Status</span>
              <StatusBadge status={status} />
            </div>
            {stored && <p className="text-xs text-slate-500">Cập nhật {new Date(stored.updatedAt).toLocaleString('vi-VN')}</p>}
            {Object.keys(errors).length > 0 && <Alert>Có {Object.keys(errors).length} lỗi cần sửa</Alert>}
            {serverError && <Alert>{serverError}</Alert>}
            {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
            <Button className="w-full" disabled={busy} onClick={() => save(true)}>{status === 'published' ? 'Publish lại' : 'Publish'}</Button>
            <Button className="w-full" variant="secondary" disabled={busy} onClick={() => save(false)}>Lưu nháp</Button>
            {stored?.publishedAt && <Button className="w-full" variant="secondary" disabled={busy} onClick={unpublish}>Unpublish</Button>}
            {stored && <Button className="w-full" variant="danger" disabled={busy} onClick={remove}>Xoá entry</Button>}
          </Card>
        </aside>
      </div>
    </div>
  )
}
