'use client'

import Link from 'next/link'
import { useCms } from '@/services/cms/store'
import Card from '@/components/ui/card'
import Alert from '@/components/ui/alert'

const TH = 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500'

export default function ContentTypeList() {
  const { types, entries, ready, error } = useCms()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Content model</h1>
          <p className="text-sm text-slate-500">{ready ? `${types.length} content type` : ' '}</p>
        </div>
        <Link href="/content-model/new" className="rounded-full bg-blue-600 px-5 py-2.5 text-[15px] font-semibold text-white hover:bg-blue-700">
          Add content type
        </Link>
      </div>

      {error && <Alert>{error}</Alert>}

      {ready && types.length === 0 ? (
        <Card className="p-10 text-center text-slate-500">Chưa có content type nào. Hãy tạo cái đầu tiên.</Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr><th className={TH}>Name</th><th className={TH}>API ID</th><th className={TH}>Description</th><th className={TH}>Fields</th><th className={TH}>Entries</th><th className={TH}>Updated</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {types.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold"><Link href={`/content-model/${t.id}`} className="text-blue-700 hover:underline">{t.name}</Link></td>
                  <td className="px-4 py-3"><code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{t.id}</code></td>
                  <td className="max-w-xs truncate px-4 py-3 text-slate-600">{t.description || '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{t.fields.length}</td>
                  <td className="px-4 py-3 text-slate-600">{entries.filter((e) => e.typeId === t.id).length}</td>
                  <td className="px-4 py-3 text-slate-600">{new Date(t.updatedAt).toLocaleDateString('vi-VN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
