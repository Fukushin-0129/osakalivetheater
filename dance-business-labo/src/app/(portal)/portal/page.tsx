import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Ticket, FileText, Calendar, AlertTriangle, Clock } from 'lucide-react'

export default async function PortalPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // メールアドレスで生徒を特定
  const { data: student } = await supabase
    .from('students')
    .select('*')
    .eq('email', user?.email ?? '')
    .single()

  if (!student) {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-4">🕺</div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">ようこそ！</h1>
        <p className="text-gray-500 text-sm">
          アカウントに生徒情報が紐付けられていません。<br />
          先生にご確認ください。
        </p>
        <p className="text-xs text-gray-400 mt-4">{user?.email}</p>
      </div>
    )
  }

  const today = new Date().toISOString().split('T')[0]

  const [{ data: tickets }, { data: records }, { data: upcomingLessons }] = await Promise.all([
    supabase.from('student_tickets')
      .select('*, ticket_types(name)')
      .eq('student_id', student.id)
      .order('expires_at'),
    supabase.from('student_records')
      .select('*')
      .eq('student_id', student.id)
      .order('record_date', { ascending: false })
      .limit(3),
    supabase.from('lessons')
      .select('*')
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at')
      .limit(5),
  ])

  const activeTickets = (tickets ?? []).filter(t =>
    t.total_count - t.used_count > 0 && (!t.expires_at || new Date(t.expires_at) >= new Date())
  )
  const expiringTickets = (tickets ?? []).filter(t => {
    if (!t.expires_at) return false
    const diff = Math.ceil((new Date(t.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    return diff >= 0 && diff <= 30 && t.total_count - t.used_count > 0
  })

  return (
    <div>
      {/* あいさつ */}
      <div className="bg-indigo-600 rounded-2xl p-6 text-white mb-6 shadow-lg">
        <p className="text-indigo-200 text-sm mb-1">こんにちは</p>
        <h1 className="text-2xl font-bold">{student.name} さん</h1>
        {student.name_kana && <p className="text-indigo-300 text-sm mt-0.5">{student.name_kana}</p>}
      </div>

      {/* 期限切れ警告 */}
      {expiringTickets.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-orange-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-orange-700">チケットの期限が近づいています</p>
            <p className="text-xs text-orange-600 mt-0.5">
              {expiringTickets.map(t => (t.ticket_types as { name: string } | null)?.name).join('、')} が30日以内に期限切れになります
            </p>
          </div>
        </div>
      )}

      {/* チケット残数 */}
      <div className="bg-white rounded-xl shadow-sm p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-700 flex items-center gap-2"><Ticket size={16} className="text-indigo-500" /> チケット残数</h2>
          <Link href="/portal/reserve" className="text-xs text-indigo-600 hover:underline">レッスン予約 →</Link>
        </div>
        {activeTickets.length === 0 ? (
          <p className="text-gray-400 text-sm">有効なチケットがありません</p>
        ) : (
          <div className="space-y-3">
            {activeTickets.map(t => {
              const remaining = t.total_count - t.used_count
              const pct = Math.round((remaining / t.total_count) * 100)
              const color = remaining <= 2 ? 'bg-orange-400' : remaining <= 5 ? 'bg-yellow-400' : 'bg-green-400'
              const expiresAt = t.expires_at
              const daysLeft = expiresAt ? Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null
              return (
                <div key={t.id}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="font-medium text-gray-700">{(t.ticket_types as { name: string } | null)?.name ?? '—'}</span>
                    <div className="flex items-center gap-2">
                      {daysLeft !== null && daysLeft <= 30 && (
                        <span className="text-xs text-orange-500 flex items-center gap-1"><Clock size={11} />{daysLeft}日後期限</span>
                      )}
                      <span className="font-bold text-indigo-600">{remaining}<span className="text-gray-400 font-normal text-xs">/{t.total_count}回</span></span>
                    </div>
                  </div>
                  <div className="bg-gray-100 rounded-full h-2">
                    <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
                  </div>
                  {expiresAt && (
                    <p className="text-xs text-gray-400 mt-1">有効期限: {expiresAt}</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 直近のレッスン */}
      <div className="bg-white rounded-xl shadow-sm p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-700 flex items-center gap-2"><Calendar size={16} className="text-indigo-500" /> 直近のレッスン</h2>
          <Link href="/portal/reserve" className="text-xs text-indigo-600 hover:underline">一覧を見る →</Link>
        </div>
        {!upcomingLessons || upcomingLessons.length === 0 ? (
          <p className="text-gray-400 text-sm">予定されているレッスンはありません</p>
        ) : (
          <ul className="space-y-2">
            {upcomingLessons.map(l => (
              <li key={l.id} className="flex items-center gap-3 text-sm py-1">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-gray-800">{l.title}</span>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {new Date(l.scheduled_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                    {l.location && <span className="ml-2">📍{l.location}</span>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 最近のカルテ */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-700 flex items-center gap-2"><FileText size={16} className="text-indigo-500" /> 最近のカルテ</h2>
          <Link href="/portal/records" className="text-xs text-indigo-600 hover:underline">すべて見る →</Link>
        </div>
        {!records || records.length === 0 ? (
          <p className="text-gray-400 text-sm">記録がありません</p>
        ) : (
          <ul className="space-y-3">
            {records.map(r => (
              <li key={r.id} className="border-l-2 border-indigo-200 pl-3">
                <div className="text-xs text-indigo-500 font-medium mb-1">{r.record_date}</div>
                <p className="text-sm text-gray-700 line-clamp-2">{r.content}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
