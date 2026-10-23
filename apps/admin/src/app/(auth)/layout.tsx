import Link from 'next/link'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-10">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <span className="h-8 w-8 rounded-lg bg-slate-900" aria-hidden="true" />
        <span className="text-lg font-bold">imgcdn</span>
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </main>
  )
}
