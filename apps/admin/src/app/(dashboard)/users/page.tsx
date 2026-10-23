import { redirect } from 'next/navigation'
import { getMe, getUsers } from '@/services/lib/api'
import UserRow from '@/components/features/users/user-row'
import Card from '@/components/ui/card'

export const metadata = { title: 'Quản lý user' }

const TH = 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500'

export default async function UsersPage() {
  const me = await getMe()
  if (!me) redirect('/login')
  if (me.role !== 'admin') redirect('/assets')
  const users = await getUsers()

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
    </div>
  )
}
