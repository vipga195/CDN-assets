'use client'

import { useActionState, useState } from 'react'
import { upload } from './actions'
import Button from '@/components/ui/button'
import Alert from '@/components/ui/alert'

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024 // keep in sync with ImgOptions.MaxUploadBytes in the API

export default function UploadForm() {
  const [error, action, pending] = useActionState(upload, null)
  const [tooLarge, setTooLarge] = useState(false)

  return (
    <form action={action} className="space-y-3">
      <input
        type="file"
        name="file"
        accept="image/png,image/jpeg"
        required
        onChange={(e) => setTooLarge((e.target.files?.[0]?.size ?? 0) > MAX_UPLOAD_BYTES)}
        className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-full file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
      />
      <p className="text-xs text-slate-500">PNG hoặc JPEG, tối đa 20MB.</p>
      {tooLarge && <Alert>Ảnh tối đa 20MB</Alert>}
      {error && <Alert>{error}</Alert>}
      <Button disabled={pending || tooLarge}>{pending ? 'Đang tải...' : 'Tải lên'}</Button>
    </form>
  )
}
