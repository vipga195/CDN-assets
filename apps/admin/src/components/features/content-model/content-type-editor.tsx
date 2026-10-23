'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { cms, useCms } from '@/services/cms/store'
import { API_ID_RE, FIELD_TYPES, toApiId, type ContentType, type Field } from '@/services/cms/types'
import FieldDialog from './field-dialog'
import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import Input from '@/components/ui/input'
import Select from '@/components/ui/select'
import Alert from '@/components/ui/alert'

const BLANK: ContentType = { id: '', name: '', description: '', displayFieldId: '', fields: [], updatedAt: '' }
const TYPE_LABEL = Object.fromEntries(FIELD_TYPES.map((t) => [t.value, t.label]))

export default function ContentTypeEditor({ typeId }: { typeId: string }) {
  const router = useRouter()
  const { types, ready } = useCms()
  const isNew = typeId === 'new'
  const [draft, setDraft] = useState<ContentType | null>(null)
  const [idTouched, setIdTouched] = useState(false)
  const [dialog, setDialog] = useState<{ open: boolean; field: Field | null }>({ open: false, field: null })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Initialise once the store has loaded; later store updates must not overwrite local edits.
  useEffect(() => {
    if (!ready || draft) return
    if (isNew) setDraft(BLANK)
    else {
      const t = types.find((x) => x.id === typeId)
      if (t) setDraft(t)
    }
  }, [ready, draft, isNew, types, typeId])

  if (!ready) return <p className="text-slate-500">Đang tải...</p>
  if (!draft) {
    return (
      <Card className="p-10 text-center text-slate-500">
        Không tìm thấy content type. <Link href="/content-model" className="font-semibold text-blue-700">Về danh sách</Link>
      </Card>
    )
  }

  const d = draft
  const set = (patch: Partial<ContentType>) => setDraft({ ...d, ...patch })
  const textFields = d.fields.filter((f) => f.type === 'text')

  function saveField(f: Field) {
    const exists = d.fields.some((x) => x.id === f.id)
    const fields = exists ? d.fields.map((x) => (x.id === f.id ? f : x)) : [...d.fields, f]
    set({ fields, displayFieldId: d.displayFieldId || (f.type === 'text' ? f.id : '') })
    setDialog({ open: false, field: null })
  }

  function removeField(id: string) {
    const fields = d.fields.filter((f) => f.id !== id)
    set({ fields, displayFieldId: d.displayFieldId === id ? '' : d.displayFieldId })
  }

  function move(i: number, dir: -1 | 1) {
    const fields = [...d.fields]
    const j = i + dir
    if (j < 0 || j >= fields.length) return
    ;[fields[i], fields[j]] = [fields[j], fields[i]]
    set({ fields })
  }

  async function save(): Promise<void> {
    if (!d.name.trim()) return setError('Nhập tên content type')
    if (!API_ID_RE.test(d.id)) return setError('API ID bắt đầu bằng chữ cái, chỉ gồm chữ, số, dấu gạch dưới')
    if (isNew && types.some((t) => t.id === d.id)) return setError('API ID đã tồn tại')
    if (d.fields.length === 0) return setError('Thêm ít nhất một field')
    setError(null)
    setBusy(true)
    const err = await cms.saveType({ ...d, name: d.name.trim(), displayFieldId: d.displayFieldId || textFields[0]?.id || d.fields[0].id }, isNew)
    setBusy(false)
    if (err) setError(err)
    else router.push('/content-model')
  }

  async function remove(): Promise<void> {
    if (!confirm(`Xoá content type "${d.name}"?`)) return
    setError(null)
    setBusy(true)
    const err = await cms.deleteType(d.id)
    setBusy(false)
    if (err) setError(err)
    else router.push('/content-model')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/content-model" className="text-sm font-semibold text-blue-700">← Content model</Link>
          <h1 className="text-2xl font-bold">{isNew ? 'New content type' : d.name}</h1>
        </div>
        <div className="flex gap-2">
          {!isNew && <Button variant="danger" disabled={busy} onClick={remove}>Xoá</Button>}
          <Button disabled={busy} onClick={save}>Lưu</Button>
        </div>
      </div>

      {error && <Alert>{error}</Alert>}

      <Card className="grid gap-4 p-6 md:grid-cols-2">
        <label className="space-y-1 text-sm font-semibold">
          Name
          <Input
            value={d.name}
            onChange={(e) => set({ name: e.target.value, ...(isNew && !idTouched ? { id: toApiId(e.target.value) } : {}) })}
          />
        </label>
        <label className="space-y-1 text-sm font-semibold">
          API ID
          <Input value={d.id} disabled={!isNew} onChange={(e) => { set({ id: e.target.value }); setIdTouched(true) }} />
        </label>
        <label className="space-y-1 text-sm font-semibold md:col-span-2">
          Description
          <Input value={d.description} onChange={(e) => set({ description: e.target.value })} />
        </label>
        <label className="space-y-1 text-sm font-semibold">
          Display field
          <Select value={d.displayFieldId} onChange={(e) => set({ displayFieldId: e.target.value })}>
            <option value="">Tự chọn field Text đầu tiên</option>
            {textFields.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </Select>
        </label>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Fields <span className="text-sm font-medium text-slate-500">({d.fields.length})</span></h2>
          <Button variant="secondary" size="sm" onClick={() => setDialog({ open: true, field: null })}>Add field</Button>
        </div>
        {d.fields.length === 0 ? (
          <Card className="p-8 text-center text-slate-500">Chưa có field nào.</Card>
        ) : (
          <Card className="divide-y divide-slate-100">
            {d.fields.map((f, i) => (
              <div key={f.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{f.name}{f.required && <span className="ml-1 text-red-600" title="Bắt buộc">*</span>}</p>
                  <p className="text-xs text-slate-500"><code>{f.id}</code></p>
                </div>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                  {TYPE_LABEL[f.type]}{f.type === 'reference' && f.refTypeId ? ` → ${types.find((t) => t.id === f.refTypeId)?.name ?? f.refTypeId}` : ''}
                </span>
                <div className="flex gap-1">
                  <Button size="sm" variant="secondary" aria-label="Lên" disabled={i === 0} onClick={() => move(i, -1)}>↑</Button>
                  <Button size="sm" variant="secondary" aria-label="Xuống" disabled={i === d.fields.length - 1} onClick={() => move(i, 1)}>↓</Button>
                  <Button size="sm" variant="secondary" onClick={() => setDialog({ open: true, field: f })}>Sửa</Button>
                  <Button size="sm" variant="danger" onClick={() => removeField(f.id)}>Xoá</Button>
                </div>
              </div>
            ))}
          </Card>
        )}
      </section>

      <FieldDialog
        open={dialog.open}
        initial={dialog.field}
        fields={d.fields}
        types={types}
        onClose={() => setDialog({ open: false, field: null })}
        onSave={saveField}
      />
    </div>
  )
}
