import type { Metadata } from 'next'
import Link from 'next/link'
import { CDN_URL } from '@/services/lib/api'
import { SITE_URL } from '@/services/lib/site'

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

export default function DocsPage(): React.ReactElement {
  return (
    <main className="mx-auto max-w-3xl space-y-4 [&_code]:rounded [&_code]:bg-slate-200 [&_code]:px-1 [&_h2]:pt-6 [&_h2]:text-xl [&_h2]:font-bold [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-6 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-slate-900 [&_pre]:p-4 [&_pre]:text-sm [&_pre]:text-slate-100 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6 [&_li_ul]:mt-1 [&_a]:font-semibold [&_a]:underline">
      <h1 className="text-3xl font-bold">imgcdn</h1>
      <p>Tải ảnh PNG/JPEG lên một lần, nhận link ảnh đã resize và đổi định dạng (avif, webp).</p>

      <h2>Bắt đầu</h2>
      <ol>
        <li>Đăng ký tài khoản, rồi <Link href="/login">đăng nhập</Link>.</li>
        <li>Kéo thả hoặc chọn ảnh ở trang thư viện (tối đa 20MB, 50 megapixel mỗi ảnh).</li>
        <li>Bấm &quot;Tạo link&quot;, nhập kích thước, chất lượng, định dạng rồi copy link.</li>
      </ol>

      <h2>Link ảnh</h2>
      <pre>{`${CDN_URL}/i/<id>?w=512&h=512&fit=crop&q=80&fm=webp`}</pre>
      <p>Tất cả tham số đều không bắt buộc:</p>
      <ul>
        <li><code>w</code>, <code>h</code>: chiều rộng, chiều cao (pixel), số nguyên từ 1 đến 4000. Chỉ nhập một chiều thì giữ nguyên tỷ lệ. Ảnh không bao giờ được phóng to quá kích thước gốc. Bỏ trống cả hai thì dùng chiều rộng 1024 (hoặc nhỏ hơn nếu ảnh gốc nhỏ hơn).</li>
        <li><code>fit</code>: cách xử lý khi nhập cả <code>w</code> và <code>h</code>. Mặc định là <code>scale</code>.
          <ul>
            <li><code>scale</code>: ép ảnh về đúng <code>w</code>x<code>h</code>, <strong>có thể làm méo ảnh</strong> nếu tỷ lệ khác ảnh gốc.</li>
            <li><code>crop</code>: giữ tỷ lệ, phóng vừa đủ rồi cắt phần thừa ở giữa.</li>
            <li><code>pad</code>: giữ tỷ lệ, ảnh nằm gọn trong khung và thêm viền cho đủ kích thước.</li>
          </ul>
        </li>
        <li><code>q</code>: chất lượng từ 1 đến 100. Bỏ trống thì dùng chất lượng mặc định. Không ảnh hưởng ảnh PNG đầu ra vì PNG không mất dữ liệu.</li>
        <li><code>fm</code>: <code>avif</code>, <code>webp</code> hoặc <code>orig</code>. Bỏ trống thì định dạng theo header <code>Accept</code> của trình duyệt. Tham số cũ <code>fmt</code> vẫn dùng được.</li>
        <li>Giá trị không hợp lệ trả về lỗi 400 kèm thông báo.</li>
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
