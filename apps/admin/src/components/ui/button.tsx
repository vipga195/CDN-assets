import type { ButtonHTMLAttributes } from 'react'

const VARIANTS = {
  primary: 'bg-slate-900 text-white hover:bg-slate-700',
  secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100',
  danger: 'border border-red-200 bg-white text-red-600 hover:bg-red-50',
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof VARIANTS
  size?: 'sm' | 'md'
}

export default function Button({ variant = 'primary', size = 'md', className = '', ...rest }: Props) {
  const pad = size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-5 py-2.5 text-[15px]'
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center rounded-full font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${pad} ${VARIANTS[variant]} ${className}`}
    />
  )
}
