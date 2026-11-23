import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getMe, getUsers } from '@/services/lib/api'
import UserRow from '@/components/features/users/user-row'
import Card from '@/components/ui/card'

export const metadata = { title: 'Quản lý user' }

const PAGER = 'rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-100'
const TH = 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500'

export default async function UsersPage({ searchParams }: {
  searchParams: Promise<{ after_id?: string; seen?: string }>
}) {
  const me = await getMe()
  if (!me) redirect('/login')
  if (me.role !== 'admin') redirect('/assets')
  const { after_id, seen: seenRaw } = await searchParams
  const seen = Math.max(0, Number(seenRaw) || 0)
  const page = await getUsers(after_id && /^\d+$/.test(after_id) ? after_id : undefined)
  const users = page?.items
  const total = page?.total ?? 0
  const last = users?.[users.length - 1]
  const hasMore = !!users && seen + users.length < total

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Quản lý user</h1>
      {!users ? (
        <Card className="p-10 text-center text-slate-500">Không tải được danh sách user</Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr><th className={TH}>Email</th><th className={TH}>Role</th><th className={TH}>Quota</th><th className={TH}>Đã dùng</th><th className={TH}>Trạng thái</th><th className={TH} /></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => <UserRow key={u.id} user={u} isSelf={u.email === me.email} />)}
            </tbody>
          </table>
        </Card>
      )}

      {users && (
        <nav className="flex items-center justify-between gap-4" aria-label="Phân trang">
          <span className="text-sm text-slate-500">
            {users.length ? `${seen + 1}-${seen + users.length}` : 0} / {total}
          </span>
          <div className="flex gap-3">
            {after_id && <Link href="/users" className={PAGER}>Về đầu</Link>}
            {hasMore && last && (
              <Link
                className={PAGER}
                href={`/users?${new URLSearchParams({ after_id: String(last.id), seen: String(seen + users.length) })}`}
              >
                Trang sau
              </Link>
            )}
          </div>
        </nav>
      )}
    </div>
  )
}
