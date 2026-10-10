import { getAuthenticatedPortalStudent } from '@/lib/portal/auth'
import Link from 'next/link'
import { Ticket, FileText, Calendar, AlertTriangle, Clock, Video, Play } from 'lucide-react'

function getYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/)
  return m ? m[1] : null
}

// DBに保存されたタイムスタンプはタイムゾーンなし文字列として扱い、
// そのまま日本時間として解釈する（UTC変換しない）
function parseJST(s: string): Date {
  const clean = s.slice(0, 16).replace(' ', 'T')
  const [datePart, timePart] = clean.split('T')
  const [y, m, d] = datePart.split('-').map(Number)
  const [h, min] = (timePart ?? '00:00').split(':').map(Number)
  return new Date(y, m - 1, d, h, min)
}

const TICKET_GRADIENTS = [
  'from-indigo-500 to-purple-500',
  'from-pink-500 to-rose-500',
  'from-teal-500 to-emerald-500',
  'from-orange-400 to-amber-500',
]

export default async function PortalPage() {
  const { user, student, admin } = await getAuthenticatedPortalStudent()

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

  const [{ data: tickets }, { data: records }, { data: reservations }, { data: attendedRows }] = await Promise.all([
    admin!.from('student_tickets')
      .select('*, ticket_types(name)')
      .eq('student_id', student.id)
      .order('expires_at'),
    admin!.from('student_records')
      .select('*')
      .eq('student_id', student.id)
      .order('record_date', { ascending: false })
      .limit(3),
    admin!.from('student_reservations')
      .select('lesson_id')
      .eq('student_id', student.id),
    admin!.from('attendance')
      .select('lesson_id')
      .eq('student_id', student.id)
      .in('status', ['present', 'late']),
  ])

  const reservationLessonIds = (reservations ?? []).map((reservation) => reservation.lesson_id)
  const { data: upcomingLessons } = reservationLessonIds.length
    ? await admin!.from('lessons')
        .select('id, title, scheduled_at, location')
        .in('id', reservationLessonIds)
        .gte('scheduled_at', new Date().toISOString())
        .order('scheduled_at')
        .limit(5)
    : { data: [] }

  const attendedLessonIds = [...new Set((attendedRows ?? []).map(r => r.lesson_id))]
  const { data: attendedLessons } = attendedLessonIds.length
    ? await admin!.from('lessons')
        .select('id, scheduled_at, lesson_videos(id, url, label)')
        .in('id', attendedLessonIds)
        .order('scheduled_at', { ascending: false })
        .limit(8)
    : { data: [] }

  type VideoWithLesson = { id: string; url: string; label: string | null; scheduledAt: string }
  const recentVideos: VideoWithLesson[] = (attendedLessons ?? [])
    .flatMap(l => (l.lesson_videos ?? []).map((v: { id: string; url: string; label: string | null }) => ({ ...v, scheduledAt: l.scheduled_at })))
    .slice(0, 6)

  const attendedCount = attendedLessonIds.length
  const daysSinceJoined = student.joined_at
    ? Math.max(0, Math.floor((Date.now() - new Date(student.joined_at).getTime()) / (1000 * 60 * 60 * 24)))
    : null

  const activeTickets = (tickets ?? []).filter(t =>
    t.total_count - t.used_count > 0 && (!t.expires_at || new Date(t.expires_at) >= new Date())
  )
  const expiringTickets = (tickets ?? []).filter(t => {
    if (!t.expires_at) return false
    const diff = Math.ceil((new Date(t.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    return diff >= 0 && diff <= 30 && t.total_count - t.used_count > 0
  })

  // プライベートバケットの署名付きURL（1時間有効）
  let avatarSignedUrl: string | null = null
  if (student.avatar_url) {
    avatarSignedUrl = student.avatar_url.startsWith('http')
      ? student.avatar_url
      : (await admin!.storage.from('student-avatars').createSignedUrl(student.avatar_url, 3600)).data?.signedUrl ?? null
  }

  return (
    <div>
      {/* あいさつ・プロフィール（雑誌風メインビジュアル） */}
      {/* スマホ: 全面写真にテキストを重ねる */}
      <div className="relative overflow-hidden rounded-2xl mb-6 shadow-lg bg-gray-200 sm:hidden">
        {avatarSignedUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarSignedUrl} alt={student.name} className="w-full aspect-[4/5] object-contain bg-black" />
        ) : (
          <div className="w-full aspect-[4/5] bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-6xl">🕺</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/70 mb-1">Dance Labo Member</p>
          <h1 className="text-2xl font-bold drop-shadow-sm truncate">{student.name} さん</h1>
          {student.name_kana && <p className="text-xs text-white/70 mt-0.5">{student.name_kana}</p>}
          <div className="flex gap-4 mt-3">
            <div>
              <span className="text-lg font-bold">{attendedCount}</span>
              <span className="text-[11px] text-white/70 ml-1">回 通算レッスン</span>
            </div>
            {daysSinceJoined !== null && (
              <div>
                <span className="text-lg font-bold">{daysSinceJoined}</span>
                <span className="text-[11px] text-white/70 ml-1">日目</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PC: 雑誌の見開きのように、全身が見える写真とテキストを左右に配置 */}
      <div className="hidden sm:flex overflow-hidden rounded-2xl mb-6 shadow-lg bg-gray-900">
        <div className="w-64 min-h-80 flex-shrink-0 bg-black flex items-center justify-center">
          {avatarSignedUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarSignedUrl} alt={student.name} className="w-full h-full object-contain" />
          ) : (
            <div className="w-full aspect-[3/4] bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-6xl">🕺</div>
          )}
        </div>
        <div className="flex-1 bg-gradient-to-br from-indigo-700 to-purple-700 text-white p-8 flex flex-col justify-center">
          <p className="text-xs uppercase tracking-[0.3em] text-indigo-200 mb-2">Dance Labo Member</p>
          <h1 className="text-4xl font-bold drop-shadow-sm">{student.name} さん</h1>
          {student.name_kana && <p className="text-sm text-indigo-200 mt-1">{student.name_kana}</p>}
          <div className="flex gap-8 mt-6 pt-6 border-t border-white/20">
            <div>
              <span className="text-3xl font-bold">{attendedCount}</span>
              <span className="text-sm text-indigo-200 ml-1.5">回 通算レッスン</span>
            </div>
            {daysSinceJoined !== null && (
              <div>
                <span className="text-3xl font-bold">{daysSinceJoined}</span>
                <span className="text-sm text-indigo-200 ml-1.5">日目</span>
              </div>
            )}
          </div>
        </div>
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

      {/* レッスンの様子（動画） */}
      {recentVideos.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-5 mb-4">
          <h2 className="font-semibold text-gray-700 flex items-center gap-2 mb-3">
            <Video size={16} className="text-indigo-500" /> レッスンの様子
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
            {recentVideos.map(v => {
              const ytId = getYouTubeId(v.url)
              return (
                <a key={v.id} href={v.url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 w-36 group">
                  <div className="relative w-36 aspect-video rounded-lg overflow-hidden bg-gray-100">
                    {ytId ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300"><Video size={20} /></div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/20 transition-colors">
                      <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center shadow-sm">
                        <Play size={14} className="text-indigo-600 ml-0.5" fill="currentColor" />
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1.5 truncate">
                    {v.label ?? parseJST(v.scheduledAt).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                  </p>
                </a>
              )
            })}
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
          <div className="grid grid-cols-2 gap-3">
            {activeTickets.map((t, i) => {
              const remaining = t.total_count - t.used_count
              const pct = Math.round((remaining / t.total_count) * 100)
              const expiresAt = t.expires_at
              const daysLeft = expiresAt ? Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null
              const gradient = TICKET_GRADIENTS[i % TICKET_GRADIENTS.length]
              return (
                <div key={t.id} className={`rounded-xl p-4 bg-gradient-to-br ${gradient} text-white shadow-sm`}>
                  <p className="text-xs text-white/80 truncate">{(t.ticket_types as { name: string } | null)?.name ?? '—'}</p>
                  <p className="text-2xl font-bold mt-1">
                    {remaining}<span className="text-xs font-normal text-white/70">/{t.total_count}回</span>
                  </p>
                  <div className="h-1.5 bg-white/25 rounded-full mt-2.5">
                    <div className="h-1.5 bg-white rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  {daysLeft !== null && (
                    <p className="text-[11px] text-white/80 mt-1.5 flex items-center gap-1">
                      <Clock size={10} /> {daysLeft <= 30 ? `あと${daysLeft}日` : expiresAt}
                    </p>
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
          <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
            {upcomingLessons.map(l => {
              const d = parseJST(l.scheduled_at)
              return (
                <div key={l.id} className="flex-shrink-0 w-28 bg-indigo-50 rounded-xl p-3 text-center">
                  <div className="text-[10px] text-indigo-400 font-medium">{d.toLocaleDateString('ja-JP', { weekday: 'short' })}曜</div>
                  <div className="text-xl font-bold text-indigo-700 leading-tight">{d.getDate()}</div>
                  <div className="text-[10px] text-gray-400">{d.getMonth() + 1}月</div>
                  <div className="text-xs font-medium text-gray-700 mt-1.5">
                    {d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="text-[10px] text-gray-400 truncate mt-0.5" title={l.title}>{l.title}</div>
                </div>
              )
            })}
          </div>
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
          <ul>
            {records.map((r, i) => (
              <li key={r.id} className="flex gap-3">
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className="w-2 h-2 rounded-full bg-indigo-400 mt-2" />
                  {i < records.length - 1 && <div className="flex-1 w-px bg-indigo-100 my-0.5" />}
                </div>
                <div className={`flex-1 min-w-0 ${i < records.length - 1 ? 'pb-4' : ''}`}>
                  <div className="text-xs text-indigo-500 font-medium mb-1">{r.record_date}</div>
                  <div className="bg-indigo-50 rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm text-gray-700 leading-relaxed">
                    {r.content}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
