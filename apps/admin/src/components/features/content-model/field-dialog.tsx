'use client'

import { useState } from 'react'
import { API_ID_RE, FIELD_TYPES, toApiId, type ContentType, type Field, type FieldType } from '@/services/cms/types'
import Modal from '@/components/ui/modal'
import Button from '@/components/ui/button'
import Input from '@/components/ui/input'
import Select from '@/components/ui/select'
import Alert from '@/components/ui/alert'

type Props = {
  open: boolean
  initial: Field | null // null = add a new field
  fields: Field[]
  types: ContentType[]
  onClose: () => void
  onSave: (f: Field) => void
}

export default function FieldDialog({ open, initial, fields, types, onClose, onSave }: Props) {
  return (
    <Modal open={open} onClose={onClose} title={initial ? `Sửa field: ${initial.name}` : 'Thêm field'}>
      <FieldForm initial={initial} fields={fields} types={types} onClose={onClose} onSave={onSave} />
    </Modal>
  )
}

function FieldForm({ initial, fields, types, onClose, onSave }: Omit<Props, 'open'>) {
  const [name, setName] = useState(initial?.name ?? '')
  const [id, setId] = useState(initial?.id ?? '')
  const [idTouched, setIdTouched] = useState(!!initial)
  const [type, setType] = useState<FieldType>(initial?.type ?? 'text')
  const [required, setRequired] = useState(initial?.required ?? false)
  const [refTypeId, setRefTypeId] = useState(initial?.refTypeId ?? '')
  const [error, setError] = useState<string | null>(null)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('Nhập tên field')
    if (!API_ID_RE.test(id)) return setError('Field ID bắt đầu bằng chữ cái, chỉ gồm chữ, số, dấu gạch dưới')
    if (!initial && fields.some((f) => f.id === id)) return setError('Field ID đã tồn tại')
    onSave({ id, name: name.trim(), type, required, ...(type === 'reference' && refTypeId ? { refTypeId } : {}) })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block space-y-1 text-sm font-semibold">
        Name
        <Input
          value={name}
          autoFocus
          onChange={(e) => {
            setName(e.target.value)
            if (!idTouched) setId(toApiId(e.target.value))
          }}
        />
      </label>
      <label className="block space-y-1 text-sm font-semibold">
        Field ID
        <Input value={id} disabled={!!initial} onChange={(e) => { setId(e.target.value); setIdTouched(true) }} />
      </label>

      <fieldset disabled={!!initial} className="space-y-2">
        <legend className="text-sm font-semibold">Type {initial && <span className="font-normal text-slate-500">(không đổi được)</span>}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {FIELD_TYPES.map((t) => (
            <label key={t.value} className={`flex cursor-pointer gap-2 rounded-lg border p-3 text-sm ${type === t.value ? 'border-blue-600 bg-blue-50' : 'border-slate-200'}`}>
              <input type="radio" name="type" checked={type === t.value} onChange={() => setType(t.value)} />
              <span><span className="block font-semibold">{t.label}</span><span className="text-xs text-slate-500">{t.hint}</span></span>
            </label>
          ))}
        </div>
      </fieldset>

      {type === 'reference' && (
        <label className="block space-y-1 text-sm font-semibold">
          Chỉ cho phép content type
          <Select value={refTypeId} onChange={(e) => setRefTypeId(e.target.value)}>
            <option value="">Bất kỳ</option>
            {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
        </label>
      )}

      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
        Bắt buộc (phải có giá trị trước khi publish)
      </label>

      {error && <Alert>{error}</Alert>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>Huỷ</Button>
        <Button>{initial ? 'Lưu field' : 'Thêm field'}</Button>
      </div>
    </form>
  )
}
