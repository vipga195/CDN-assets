import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getMe, getUsers } from '../../services/lib/api'
import UserRow from '../../components/user-row'

export const metadata = { title: 'Quản lý user' }

export default async function UsersPage() {
  const me = await getMe()
  if (!me) redirect('/login')
  if (me.role !== 'admin') redirect('/assets')
  const users = await getUsers()

  if (!users) {
    return (
      <div>
        <Link href="/assets">Thư viện ảnh</Link>
        <p>Không tải được danh sách user</p>
      </div>
    )
  }

  return (
    <div>
      <Link href="/assets">Thư viện ảnh</Link>
      <table>
        <thead>
          <tr><th>Email</th><th>Role</th><th>Quota</th><th>Đã dùng</th><th>Trạng thái</th><th /></tr>
        </thead>
        <tbody>
          {users.map((u) => <UserRow key={u.id} user={u} isSelf={u.email === me.email} />)}
        </tbody>
      </table>
    </div>
  )
}