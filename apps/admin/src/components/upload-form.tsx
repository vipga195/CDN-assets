'use client'

import { useActionState, useState } from 'react'
import { upload } from './actions'

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024 // keep in sync with ImgOptions.MaxUploadBytes in the API

export default function UploadForm() {
  const [error, action, pending] = useActionState(upload, null)
  const [tooLarge, setTooLarge] = useState(false)

  return (
    <form action={action}>
      <input
        type="file"
        name="file"
        accept="image/png,image/jpeg"
        required
        onChange={(e) => setTooLarge((e.target.files?.[0]?.size ?? 0) > MAX_UPLOAD_BYTES)}
      />
      <button disabled={pending || tooLarge}>{pending ? 'Đang tải...' : 'Tải lên'}</button>
      {tooLarge && <p role="alert">Ảnh tối đa 20MB</p>}
      {error && <p role="alert">{error}</p>}
    </form>
  )
}