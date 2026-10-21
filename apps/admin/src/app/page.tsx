import { redirect } from 'next/navigation'
import { getMe } from '../lib/api'
import { logout } from './login/actions'
import MeEvents from './me-events'

export default async function Home() {
  const me = await getMe()
  if (!me) redirect('/login')

  return (
    <div>
      <p>
        {me.email} ({me.role}) - {me.used_bytes}/{me.quota_bytes} byte
      </p>
      <form action={logout}>
        <button>Đăng xuất</button>
      </form>
      <MeEvents />
    </div>
  )
}