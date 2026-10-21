import { redirect } from 'next/navigation'
import { CDN_URL, getImages, getMe } from '../lib/api'
import ImageCard from '../components/image-card'
import UploadForm from '../components/upload-form'
import { logout } from '../components/login/actions'
import MeEvents from '../components/me-events'
import Link from 'next/link'

export default async function Home() {
  const me = await getMe()
  if (!me) redirect('/login')
  const images = await getImages()

  return (
    <div>
      <p>
        {me.email} ({me.role}) - {me.used_bytes}/{me.quota_bytes} byte
      </p>
      {me.role === 'admin' && <Link href="/users">Quản lý user</Link>}
      <form action={logout}>
        <button>Đăng xuất</button>
      </form>
      <UploadForm />
      <ul>
        {images.map((img) => <ImageCard key={img.id} img={img} cdn={CDN_URL} />)}
      </ul>
      <MeEvents />
    </div>
  )
}