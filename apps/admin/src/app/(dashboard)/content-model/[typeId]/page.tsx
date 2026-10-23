import ContentTypeEditor from '@/components/features/content-model/content-type-editor'

export const metadata = { title: 'Content type' }

export default async function ContentTypePage({ params }: { params: Promise<{ typeId: string }> }) {
  const { typeId } = await params
  return <ContentTypeEditor typeId={typeId} />
}
