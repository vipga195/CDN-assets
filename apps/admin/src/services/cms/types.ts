export type FieldType = 'text' | 'longText' | 'number' | 'boolean' | 'date' | 'json' | 'media' | 'reference'

export const FIELD_TYPES: { value: FieldType; label: string; hint: string }[] = [
  { value: 'text', label: 'Text', hint: 'Tên, tiêu đề, slug' },
  { value: 'longText', label: 'Long text', hint: 'Đoạn văn, mô tả dài' },
  { value: 'number', label: 'Number', hint: 'Số nguyên hoặc thập phân' },
  { value: 'boolean', label: 'Boolean', hint: 'Đúng / sai' },
  { value: 'date', label: 'Date and time', hint: 'Ngày giờ' },
  { value: 'json', label: 'JSON object', hint: 'Dữ liệu JSON tuỳ ý' },
  { value: 'media', label: 'Media', hint: 'Một ảnh từ thư viện' },
  { value: 'reference', label: 'Reference', hint: 'Liên kết tới entry khác' },
]

export type Field = {
  id: string
  name: string
  type: FieldType
  required: boolean
  refTypeId?: string // reference only: restrict to one content type
}

export type ContentType = {
  id: string
  name: string
  description: string
  displayFieldId: string
  fields: Field[]
  updatedAt: string
}

export type EntryStatus = 'draft' | 'changed' | 'published'

export type Entry = {
  id: string
  typeId: string
  values: Record<string, unknown>
  version: number // optimistic lock, 0 for an entry not saved yet
  updatedAt: string
  publishedAt: string | null
}

export type Res<T> = { kind: 'ok'; data: T } | { kind: 'err'; error: string }

export function entryStatus(e: Entry): EntryStatus {
  if (!e.publishedAt) return 'draft'
  return e.updatedAt > e.publishedAt ? 'changed' : 'published'
}

export function entryTitle(e: Entry, t?: ContentType): string {
  const v = t ? e.values[t.displayFieldId] : undefined
  return typeof v === 'string' && v.trim() ? v : 'Untitled'
}

// "Blog post" -> "blogPost"
export function toApiId(name: string): string {
  const words = name.trim().split(/[^A-Za-z0-9]+/).filter(Boolean)
  return words.map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase())).join('')
}

export const API_ID_RE = /^[a-zA-Z][a-zA-Z0-9_]*$/

export function isEmptyValue(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === 'string' && v.trim() === '')
}
