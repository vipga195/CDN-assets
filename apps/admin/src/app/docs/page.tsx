import type { Metadata } from 'next'
import Link from 'next/link'
import { CDN_URL } from '../../lib/api'
import { SITE_URL } from '../../lib/site'

const TITLE = 'Hướng dẫn sử dụng'
const DESCRIPTION = 'Tải ảnh lên và lấy link ảnh đã tối ưu (avif, webp) với imgcdn.'

// Public page: overrides the root layout's noindex. Canonical is /docs.
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  robots: { index: true },
  alternates: { canonical: `${SITE_URL}/docs` },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${SITE_URL}/docs`, siteName: 'imgcdn', type: 'website' },
}

const WIDTHS = [64, 128, 256, 512, 1024, 2048]

export default function DocsPage(): React.ReactElement {
  return (
    <main>
      <h1>imgcdn</h1>
      <p>Tải ảnh PNG/JPEG lên một lần, nhận link ảnh đã resize và đổi định dạng (avif, webp).</p>

      <h2>Bắt đầu</h2>
      <ol>
        <li>Đăng ký tài khoản, rồi <Link href="/login">đăng nhập</Link>.</li>
        <li>Kéo thả hoặc chọn ảnh ở trang thư viện (tối đa 20MB, 50 megapixel mỗi ảnh).</li>
        <li>Chọn chiều rộng và định dạng rồi bấm copy link.</li>
      </ol>

      <h2>Link ảnh</h2>
      <pre>{`${CDN_URL}/i/<id>?w=512&fmt=webp`}</pre>
      <ul>
        <li><code>w</code>: một trong {WIDTHS.join(', ')} (pixel).</li>
        <li><code>fmt</code>: <code>avif</code>, <code>webp</code> hoặc <code>orig</code>. Bỏ trống thì định dạng theo header <code>Accept</code> của trình duyệt.</li>
        <li>Ai biết link đều xem được ảnh, vì vậy đừng chia sẻ link của ảnh riêng tư.</li>
      </ul>

      <h2>Dùng qua API</h2>
      <pre>{`curl -s -X POST ${CDN_URL}/login -H 'Content-Type: application/json' \\
  -d '{"email":"you@example.com","password":"<password>"}'
curl -s -X POST ${CDN_URL}/upload -H "Authorization: Bearer $TOKEN" -F file=@photo.jpg`}</pre>
      <p>Token có hạn 7 ngày. Dung lượng đã dùng được tính theo quota của tài khoản; vượt quota thì upload trả 413.</p>

      <h2>Giới hạn hiện tại</h2>
      <ul>
        <li>Chỉ hỗ trợ PNG và JPEG.</li>
        <li>Thư viện hiển thị tối đa 100 ảnh mới nhất.</li>
      </ul>
    </main>
  )
}
