import { redirect } from 'next/navigation'
import { CDN_URL, PAGE_SIZE, getImages, getMe } from '../../lib/api'
import ImageCard from '../../components/image-card'
import UploadForm from '../../components/upload-form'
import { logout } from '../../components/login/actions'
import MeEvents from '../../components/me-events'
import Link from 'next/link'


export const metadata={ title: 'Thư viện ảnh' }

export default async function Home({ searchParams }: { // searchParams type: add seen
searchParams: Promise<{ before_created?: string; before_id?: string; seen?: string }> }) {
  const me=await getMe()
  if (!me) redirect('/login')
 const { before_created, before_id, seen: seenRaw } = await searchParams
  const seen = Math.max(0, Number(seenRaw) || 0)
  const { items: images, total } = await getImages(
    before_created && before_id ? { created: before_created, id: before_id } : undefined,
  )
  const last = images[images.length - 1]
  const hasMore = seen + images.length < total

  return (
    <div>
      <p>
        {me.email} ({me.role}) - {me.used_bytes}/{me.quota_bytes} byte
      </p>
      {me.role==='admin'&&<Link href="/users">Quản lý user</Link>}
      <form action={logout}>
        <button>Đăng xuất</button>
      </form>
      <UploadForm />
      <ul>
        {images.map((img) => <ImageCard key={img.id} img={img} cdn={CDN_URL} />)}
      </ul>
      <MeEvents />
     {before_created && <Link href="/assets">Về đầu</Link>}
      <span>{images.length ? `${seen + 1}-${seen + images.length}` : 0} / {total}</span>
      {hasMore && last && (
        <Link href={`/assets?${new URLSearchParams({
          before_created: last.created_at,
          before_id: last.id,
          seen: String(seen + images.length),
        })}`}>
          Trang sau
        </Link>
      )}
    </div>
  )
}