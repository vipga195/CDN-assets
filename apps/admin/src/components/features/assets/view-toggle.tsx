import Link from 'next/link'

export type AssetView = 'list' | 'grid'

const ITEM = 'px-4 py-1.5 text-sm font-semibold transition-colors'

export default function ViewToggle({ view }: { view: AssetView }) {
  return (
    <div className="inline-flex overflow-hidden rounded-full border border-slate-300 bg-white" role="group" aria-label="Kiểu hiển thị">
      {(['list', 'grid'] as const).map((v) => (
        <Link
          key={v}
          href={`/assets?view=${v}`}
          aria-current={view === v}
          className={`${ITEM} ${view === v ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
        >
          {v === 'list' ? 'Danh sách' : 'Lưới'}
        </Link>
      ))}
    </div>
  )
}
