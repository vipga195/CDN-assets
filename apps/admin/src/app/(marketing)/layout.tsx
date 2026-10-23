import SiteHeader from '@/components/layout/site-header'
import SiteFooter from '@/components/layout/site-footer'

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <div className="mx-auto w-full max-w-360 px-6 py-10">{children}</div>
      <SiteFooter />
    </>
  )
}
