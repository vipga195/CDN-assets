import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CDN_URL, getImages, getMe } from '@/services/lib/api'
import AssetsBrowser from '@/components/features/assets/assets-browser'
import ViewToggle from '@/components/features/assets/view-toggle'
import UploadForm from '@/components/features/assets/upload-form'
import Card from '@/components/ui/card'
import ProgressBar from '@/components/ui/progress-bar'

export const metadata = { title: 'Media' }

const MB = 1024 ** 2
const PAGER = 'rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-100'

export default async function AssetsPage({ searchParams }: {
  searchParams: Promise<{ before_created?: string; before_id?: string; seen?: string; view?: string }>
}) {
  const me = await getMe()
  if (!me) redirect('/login')
  const { before_created, before_id, seen: seenRaw, view: viewRaw } = await searchParams
  const view = viewRaw === 'grid' ? 'grid' : 'list'
  const seen = Math.max(0, Number(seenRaw) || 0)
  const { items: images, total } = await getImages(
    before_created && before_id ? { created: before_created, id: before_id } : undefined,
  )
  const last = images[images.length - 1]
  const hasMore = seen + images.length < total

  return (
    <div className="space-y-8">
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="space-y-3 p-6">
          <h2 className="text-sm font-semibold text-slate-500">Dung lượng</h2>
          <p className="text-2xl font-bold">
            {(me.used_bytes / MB).toFixed(1)} MB <span className="text-base font-medium text-slate-500">/ {(me.quota_bytes / MB).toFixed(0)} MB</span>
          </p>
          <ProgressBar value={me.used_bytes} max={me.quota_bytes} />
        </Card>
        <Card className="p-6">
          <h2 className="mb-3 text-sm font-semibold text-slate-500">Tải ảnh lên</h2>
          <UploadForm />
        </Card>
      </div>

      <section>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">Media</h1>
          <ViewToggle view={view} />
        </div>
        {images.length === 0 ? (
          <Card className="p-10 text-center text-slate-500">Chưa có ảnh nào. Hãy tải ảnh đầu tiên lên.</Card>
        ) : (
          <AssetsBrowser images={images} cdn={CDN_URL} view={view} />
        )}
      </section>

      <nav className="flex items-center justify-between gap-4" aria-label="Phân trang">
        <span className="text-sm text-slate-500">
          {images.length ? `${seen + 1}-${seen + images.length}` : 0} / {total}
        </span>
        <div className="flex gap-3">
          {before_created && <Link href={`/assets?view=${view}`} className={PAGER}>Về đầu</Link>}
          {hasMore && last && (
            <Link
              className={PAGER}
              href={`/assets?${new URLSearchParams({
                before_created: last.created_at,
                before_id: last.id,
                seen: String(seen + images.length),
                view,
              })}`}
            >
              Trang sau
            </Link>
          )}
        </div>
      </nav>
    </div>
  )
}
