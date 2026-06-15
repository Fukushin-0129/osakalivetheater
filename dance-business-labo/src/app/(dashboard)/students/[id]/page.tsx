import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [
    { data: student },
    { data: attendance },
    { data: tickets },
    { data: records },
  ] = await Promise.all([
    supabase.from('students').select('*').eq('id', id).single(),
    supabase.from('attendance').select('*, lessons(title, scheduled_at)').eq('student_id', id).order('created_at', { ascending: false }).limit(10),
    supabase.from('student_tickets').select('*, ticket_types(name)').eq('student_id', id).order('purchased_at', { ascending: false }),
    supabase.from('student_records').select('*').eq('student_id', id).order('record_date', { ascending: false }),
  ])

  if (!student) notFound()

  const statusLabel = { present: '出席', absent: '欠席', late: '遅刻', cancelled: 'キャンセル' }
  const statusColor = { present: 'bg-green-100 text-green-700', absent: 'bg-red-100 text-red-600', late: 'bg-yellow-100 text-yellow-700', cancelled: 'bg-gray-100 text-gray-500' }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/students" className="text-gray-400 hover:text-gray-600"><ArrowLeft size={20} /></Link>
        <h1 className="text-2xl font-bold text-gray-800">{student.name}</h1>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${student.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {student.is_active ? '在籍' : '休会'}
        </span>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="font-semibold text-gray-700 mb-3">基本情報</h2>
          <dl className="space-y-2 text-sm">
            {[
              ['よみがな', student.name_kana],
              ['参加者ID', student.legacy_id != null ? `#${student.legacy_id}` : null],
              ['メール', student.email],
              ['電話番号', student.phone],
              ['生年月日', student.birthdate],
              ['体験レッスン日', student.joined_at ? new Date(student.joined_at).toLocaleDateString('ja-JP') : null],
              ['郵便番号', student.postal_code],
              ['住所', student.address],
              ['緊急連絡先', student.emergency_contact],
            ].map(([label, value]) => value && (
              <div key={label as string} className="flex gap-2">
                <dt className="text-gray-400 w-28 flex-shrink-0">{label}</dt>
                <dd className="text-gray-700">{value}</dd>
              </div>
            ))}
            {student.notes && (
              <div className="flex gap-2">
                <dt className="text-gray-400 w-28 flex-shrink-0">備考</dt>
                <dd className="text-gray-700 whitespace-pre-wrap">{student.notes}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="font-semibold text-gray-700 mb-3">チケット残数</h2>
          {!tickets || tickets.length === 0 ? (
            <p className="text-gray-400 text-sm">チケットなし</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {tickets.map(t => (
                <li key={t.id} className="flex items-center justify-between">
                  <span className="text-gray-700">{(t.ticket_types as { name: string } | null)?.name ?? '不明'}</span>
                  <span className="font-bold text-indigo-600">{t.total_count - t.used_count}回残</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="font-semibold text-gray-700 mb-3">出席履歴（直近10件）</h2>
          {!attendance || attendance.length === 0 ? (
            <p className="text-gray-400 text-sm">出席記録なし</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {attendance.map(a => {
                const lesson = a.lessons as { title: string; scheduled_at: string } | null
                return (
                  <li key={a.id} className="flex items-center justify-between">
                    <div>
                      <span className="text-gray-700">{lesson?.title}</span>
                      <span className="text-gray-400 ml-2 text-xs">
                        {lesson?.scheduled_at && new Date(lesson.scheduled_at).toLocaleDateString('ja-JP')}
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[a.status as keyof typeof statusColor]}`}>
                      {statusLabel[a.status as keyof typeof statusLabel]}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="font-semibold text-gray-700 mb-3">カルテ</h2>
          {!records || records.length === 0 ? (
            <p className="text-gray-400 text-sm">記録なし</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {records.map(r => (
                <li key={r.id}>
                  <div className="text-xs text-gray-400 mb-1">{r.record_date}</div>
                  <div className="text-gray-700 whitespace-pre-wrap">{r.content}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
