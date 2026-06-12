import { createClient } from '@/lib/supabase/server'
import { FileText } from 'lucide-react'

export default async function PortalRecordsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: student } = await supabase
    .from('students')
    .select('id, name')
    .eq('email', user?.email ?? '')
    .single()

  if (!student) {
    return <p className="text-center text-gray-500 py-16">生徒情報が見つかりません</p>
  }

  const { data: records } = await supabase
    .from('student_records')
    .select('*')
    .eq('student_id', student.id)
    .order('record_date', { ascending: false })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <FileText size={20} className="text-indigo-500" /> マイカルテ
        </h1>
        <p className="text-gray-500 text-sm mt-1">{student.name} さんのレッスン記録</p>
      </div>

      {!records || records.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-400">
          <FileText size={32} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">まだ記録がありません</p>
        </div>
      ) : (
        <div className="space-y-4">
          {records.map(r => (
            <div key={r.id} className="bg-white rounded-xl shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                  {new Date(r.record_date + 'T00:00:00').toLocaleDateString('ja-JP', {
                    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short'
                  })}
                </span>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{r.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
