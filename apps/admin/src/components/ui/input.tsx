import type { InputHTMLAttributes } from 'react'

export default function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...rest}
      className={`w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-[15px] outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 ${className}`}
    />
  )
}
