'use client'

import { useEffect, useRef } from 'react'

type Props = { open: boolean; onClose: () => void; title: string; wide?: boolean; children: React.ReactNode }

// Children mount only while open, so their state resets on every open.
export default function Modal({ open, onClose, title, wide, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className={`m-auto w-full rounded-2xl p-0 backdrop:bg-slate-900/40 ${wide ? 'max-w-3xl' : 'max-w-lg'}`}
    >
      {open && (
        <div className="space-y-4 p-6">
          <div className="flex items-start justify-between gap-4">
            <h3 className="text-lg font-bold">{title}</h3>
            <button type="button" aria-label="Đóng" onClick={onClose} className="text-slate-500 hover:text-slate-900">✕</button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  )
}
