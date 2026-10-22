'use client'

import { useState, useTransition } from 'react'
import { patchUser } from './users/actions'
import type { AdminUser } from '../services/lib/api'

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
      <td>{user.email}</td>
      <td>{user.role}</td>
      <td>
        <input type="number" min={0} step="any" value={quotaGb} onChange={(e) => setQuotaGb(e.target.value)} /> GB
        <button disabled={pending} onClick={saveQuota}>Lưu</button>
      </td>
      <td>{(user.used_bytes / GB).toFixed(2)} GB</td>
      <td>{user.disabled ? 'Đã khoá' : 'Hoạt động'}</td>
      <td>
        {!isSelf && (
          <button disabled={pending} onClick={() => run({ disabled: !user.disabled })}>
            {user.disabled ? 'Mở khoá' : 'Khoá'}
          </button>
        )}
        {error && <span> {error}</span>}
      </td>
    </tr>
  )
}