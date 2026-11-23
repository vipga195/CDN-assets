import { redirect } from 'next/navigation'
import { getMe } from '@/services/lib/api'
import AppTopbar from '@/components/layout/app-topbar'
import MeEvents from '@/components/layout/me-events'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe()
  if (!me) redirect('/login')

  return (
    <>
      <AppTopbar />
      <div className="mx-auto w-full max-w-360 px-4 py-6 md:px-6">{children}</div>
      <MeEvents />
    </>
  )
}
