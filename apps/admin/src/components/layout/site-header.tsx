import Link from 'next/link'
import { getMe } from '@/services/lib/api'
import { logout } from '@/components/features/auth/actions'
import Button from '@/components/ui/button'
import { LOGO_ID, cdnImageUrl } from '@/services/lib/site'

const LINK = 'text-[15px] font-medium text-slate-600 hover:text-slate-900 transition-colors'

export default async function SiteHeader() {
  const me = await getMe()

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex min-h-20 w-full max-w-360 flex-wrap items-center justify-between gap-x-8 gap-y-2 px-6 py-3">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          {LOGO_ID ? (
            // Served by the CDN on purpose: the site itself demonstrates the resized, converted image.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cdnImageUrl(LOGO_ID, 512)} alt="CDN" width={140} height={32} className="h-8 w-auto" />
          ) : (
            <>
              <span className="h-8 w-8 rounded-lg bg-slate-900" aria-hidden="true" />
              <span className="text-lg font-bold text-slate-900">CDN</span>
            </>
          )}
        </Link>

        <nav className="order-last flex w-full items-center gap-6 overflow-x-auto md:order-none md:w-auto md:gap-8">
          {me && <Link href="/assets" className={LINK}>Thư viện ảnh</Link>}
          {me?.role === 'admin' && <Link href="/users" className={LINK}>Người dùng</Link>}
          <Link href="/docs" className={LINK}>Tài liệu</Link>
        </nav>

        <div className="flex shrink-0 items-center gap-4">
          {me ? (
            <>
              <span className="hidden text-sm text-slate-500 sm:inline">{me.email}</span>
              <form action={logout}>
                <Button variant="secondary" size="sm">Đăng xuất</Button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="text-[15px] font-semibold text-slate-700 transition-colors hover:text-slate-900">
                Đăng nhập
              </Link>
              <Link href="/register" className="rounded-full bg-slate-900 px-5 py-2.5 text-[15px] font-semibold text-white transition-colors hover:bg-slate-700">
                Đăng ký
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
