import type { Metadata } from 'next'
import Link from 'next/link'
import { SITE_URL } from '../services/lib/site'

const TITLE = 'imgcdn - tải ảnh một lần, nhận link ảnh tối ưu'
const DESCRIPTION = 'Tải ảnh PNG/JPEG lên một lần, nhận link ảnh đã resize và đổi định dạng avif, webp.'

// Public landing page: overrides the root layout's noindex.
export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  robots: { index: true },
  alternates: { canonical: SITE_URL },
  openGraph: { title: TITLE, description: DESCRIPTION, url: SITE_URL, siteName: 'imgcdn', type: 'website' },
}

export default function LandingPage(): React.ReactElement {
  return (
    <main>
      <h1>imgcdn</h1>
      <p>{DESCRIPTION}</p>
      <ul>
        <li>Tự chọn định dạng avif, webp hoặc gốc theo trình duyệt.</li>
        <li>Resize theo chiều rộng bằng link, không cần tải lại ảnh.</li>
        <li>Quản lý ảnh và dung lượng trong thư viện cá nhân.</li>
      </ul>
      <p>
        <Link href="/login">Đăng nhập</Link> · <Link href="/docs">Hướng dẫn sử dụng</Link>
      </p>
    </main>
  )
}
