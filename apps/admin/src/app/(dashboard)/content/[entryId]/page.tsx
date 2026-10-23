import EntryEditor from '@/components/features/content/entry-editor'
import { CDN_URL, getImages } from '@/services/lib/api'

export const metadata = { title: 'Entry' }

export default async function EntryPage({ params, searchParams }: {
  params: Promise<{ entryId: string }>
  searchParams: Promise<{ type?: string }>
}) {
  const [{ entryId }, { type }] = await Promise.all([params, searchParams])
  const { items: images } = await getImages() // first page is enough for the media picker
  return <EntryEditor entryId={entryId} newTypeId={type} images={images} cdn={CDN_URL} />
}
