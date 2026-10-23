import type { Metadata } from 'next'
import Link from 'next/link'
import { OG_IMAGE_ID, SITE_URL, cdnImageUrl } from '@/services/lib/site'

const TITLE = 'imgcdn - tải ảnh một lần, nhận link ảnh tối ưu'
const DESCRIPTION = 'Tải ảnh PNG/JPEG lên một lần, nhận link ảnh đã resize và đổi định dạng avif, webp.'

// Public landing page: overrides the root layout's noindex.
export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  robots: { index: true },
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: TITLE, description: DESCRIPTION, url: SITE_URL, siteName: 'imgcdn', type: 'website',
    ...(OG_IMAGE_ID && { images: [{ url: cdnImageUrl(OG_IMAGE_ID, 2048, 'orig'), width: 1200, height: 630, alt: 'CDN - Content Delivery Network' }] }),
  },
  ...(OG_IMAGE_ID && { twitter: { card: 'summary_large_image', images: [cdnImageUrl(OG_IMAGE_ID, 2048, 'orig')] } }),
}

const FEATURES = [
  { title: 'Tự chọn định dạng', body: 'avif, webp hoặc gốc theo trình duyệt của người xem.' },
  { title: 'Resize bằng link', body: 'Đổi chiều rộng ngay trên URL, không cần tải lại ảnh.' },
  { title: 'Thư viện cá nhân', body: 'Quản lý ảnh và theo dõi dung lượng đã dùng.' },
]

export default function LandingPage(): React.ReactElement {
  return (
    <main className="mx-auto max-w-3xl py-16 text-center">
      <h1 className="text-5xl font-bold tracking-tight">imgcdn</h1>
      <p className="mt-6 text-lg text-slate-600">{DESCRIPTION}</p>
      <div className="mt-8 flex justify-center gap-4">
        <Link href="/register" className="rounded-full bg-slate-900 px-6 py-3 font-semibold text-white hover:bg-slate-700">Bắt đầu miễn phí</Link>
        <Link href="/docs" className="rounded-full border border-slate-300 bg-white px-6 py-3 font-semibold hover:bg-slate-100">Hướng dẫn sử dụng</Link>
      </div>
      <ul className="mt-16 grid gap-6 text-left sm:grid-cols-3">
        {FEATURES.map((f) => (
          <li key={f.title} className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="font-semibold">{f.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{f.body}</p>
          </li>
        ))}
      </ul>
    </main>
  )
}
