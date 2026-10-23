import EntryList from '@/components/features/content/entry-list'
import type { EntryStatus } from '@/services/cms/types'

export const metadata = { title: 'Content' }

const STATUSES = ['draft', 'changed', 'published']

export default async function ContentPage({ searchParams }: {
  searchParams: Promise<{ type?: string; status?: string; q?: string }>
}) {
  const { type, status, q } = await searchParams
  return (
    <EntryList
      type={type}
      status={status && STATUSES.includes(status) ? (status as EntryStatus) : undefined}
      q={q ?? ''}
    />
  )
}
