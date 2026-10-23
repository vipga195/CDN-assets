import type { EntryStatus } from '@/services/cms/types'

const STYLE: Record<EntryStatus, string> = {
  draft: 'bg-orange-100 text-orange-700',
  changed: 'bg-blue-100 text-blue-700',
  published: 'bg-emerald-100 text-emerald-700',
}
const LABEL: Record<EntryStatus, string> = { draft: 'Draft', changed: 'Changed', published: 'Published' }

export default function StatusBadge({ status }: { status: EntryStatus }) {
  return <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${STYLE[status]}`}>{LABEL[status]}</span>
}
