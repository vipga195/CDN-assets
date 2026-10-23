'use client'

import { useState, useTransition } from 'react'
import { patchUser } from './actions'
import type { AdminUser } from '@/services/lib/api'
import Button from '@/components/ui/button'
import Input from '@/components/ui/input'

const GB = 1024 ** 3

export default function UserRow({ user, isSelf }: { user: AdminUser; isSelf: boolean }) {
  const [quotaGb, setQuotaGb] = useState(String(user.quota_bytes / GB))
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function run(patch: { quota_bytes?: number; disabled?: boolean }) {
    start(async () => setError(await patchUser(user.id, patch)))
  }

  function saveQuota() {
    const gb = Number(quotaGb)
    if (!Number.isFinite(gb) || gb < 0) return setError('Quota không hợp lệ')
    run({ quota_bytes: Math.round(gb * GB) })
  }

  return (
    <tr>
      <td className="px-4 py-3 font-medium">{user.email}</td>
      <td className="px-4 py-3">
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold">{user.role}</span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Input className="w-24" type="number" min={0} step="any" value={quotaGb} onChange={(e) => setQuotaGb(e.target.value)} />
          <span className="text-slate-500">GB</span>
          <Button size="sm" variant="secondary" disabled={pending} onClick={saveQuota}>Lưu</Button>
        </div>
      </td>
      <td className="px-4 py-3">{(user.used_bytes / GB).toFixed(2)} GB</td>
      <td className="px-4 py-3">
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${user.disabled ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
          {user.disabled ? 'Đã khoá' : 'Hoạt động'}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          {!isSelf && (
            <Button size="sm" variant={user.disabled ? 'secondary' : 'danger'} disabled={pending} onClick={() => run({ disabled: !user.disabled })}>
              {user.disabled ? 'Mở khoá' : 'Khoá'}
            </Button>
          )}
          {error && <span role="alert" className="text-xs text-red-600">{error}</span>}
        </div>
      </td>
    </tr>
  )
}
