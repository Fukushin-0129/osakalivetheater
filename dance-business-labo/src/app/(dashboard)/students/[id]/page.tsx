import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import StudentKarteSection from '@/components/StudentKarteSection'
import StudentQrCode from '@/components/StudentQrCode'
import BackButton from '@/components/BackButton'
import { Theater, MapPin } from 'lucide-react'
import VideoThumb from '@/components/VideoThumb'

const DAYS_JA = ['日', '月', '火', '水', '木', '金', '土']

type AttendanceRecord = {
  id: string
  status: string
  lessons: { title: string; scheduled_at: string } | null
}

function AttendanceCalendar({ records }: { records: AttendanceRecord[] }) {
  // Group by year-month, collect attended dates
  const monthMap = new Map<string, Set<number>>()
  for (const a of records) {
    const dt = a.lessons?.scheduled_at
    if (!dt) continue
    const d = new Date(dt)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!monthMap.has(key)) monthMap.set(key, new Set())
    if (a.status === 'present' || a.status === 'late') {
      monthMap.get(key)!.add(d.getDate())
    }
  }

  const allMonths = [...monthMap.keys()].sort((a, b) => b.localeCompare(a))
  const months = allMonths.slice(0, 3)

  if (months.length === 0) return <p className="text-gray-400 text-sm">出席記録なし</p>

  return (
    <div className="space-y-5">
      {allMonths.length > months.length && (
        <p className="text-xs text-gray-400">直近{months.length}ヶ月分を表示（それ以前は出席管理から確認できます）</p>
      )}
      {months.map(key => {
        const [y, m] = key.split('-').map(Number)
        const attendedDays = monthMap.get(key)!
        const firstDay = new Date(y, m - 1, 1).getDay()
        const daysInMonth = new Date(y, m, 0).getDate()
        const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]

        return (
          <div key={key}>
            <div className="text-sm font-semibold text-gray-600 mb-2">{y}年{m}月</div>
            <div className="grid grid-cols-7 gap-0.5 text-center text-xs">
              {DAYS_JA.map(d => (
                <div key={d} className="py-1 text-gray-400 font-medium">{d}</div>
              ))}
              {cells.map((day, i) => {
                if (day === null) return <div key={`empty-${i}`} />
                const attended = attendedDays.has(day)
                return (
                  <div
                    key={day}
                    className={`py-1.5 rounded-md text-xs font-medium ${
                      attended
                        ? 'bg-indigo-500 text-white'
                        : 'text-gray-400'
                    }`}
                  >
                    {day}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function AttendanceList({ records }: { records: AttendanceRecord[] }) {
  const statusLabel = { present: '出席', absent: '欠席', late: '遅刻', cancelled: 'キャンセル' }
  const statusColor = { present: 'bg-green-100 text-green-700', absent: 'bg-red-100 text-red-600', late: 'bg-yellow-100 text-yellow-700', cancelled: 'bg-gray-100 text-gray-500' }

  const sorted = [...records].sort((a, b) => {
    const da = a.lessons?.scheduled_at ?? ''
    const db = b.lessons?.scheduled_at ?? ''
    return db.localeCompare(da)
  })

  if (sorted.length === 0) return <p className="text-gray-400 text-sm">出席記録なし</p>

  return (
    <ul className="space-y-2 text-sm">
      {sorted.map(a => {
        const lesson = a.lessons
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
  )
}

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [
    { data: student },
    { data: attendance },
    { data: tickets },
    { data: records },
    { data: stagePerformances },
  ] = await Promise.all([
    supabase.from('students').select('*').eq('id', id).single(),
    supabase.from('attendance').select('*, lessons(title, scheduled_at)').eq('student_id', id),
    supabase.from('student_tickets').select('*, ticket_types(name)').eq('student_id', id).order('purchased_at', { ascending: false }),
    supabase.from('student_records').select('*').eq('student_id', id).order('record_date', { ascending: false }),
    supabase.from('stage_performance_participants')
      .select('role, stage_performances(id, title, performed_at, venue)')
      .eq('student_id', id),
  ])

  if (!student) notFound()

  let familyMembers: { id: string; name: string; is_active: boolean }[] = []
  if (student.family_group) {
    const { data } = await supabase
      .from('students')
      .select('id, name, is_active')
      .eq('family_group', student.family_group)
      .neq('id', id)
    familyMembers = data ?? []
  }

  // プライベートバケットの署名付きURL（1時間有効）
  let avatarSignedUrl: string | null = null
  if (student.avatar_url && !student.avatar_url.startsWith('http')) {
    const { data } = await supabase.storage.from('student-avatars').createSignedUrl(student.avatar_url, 3600)
    avatarSignedUrl = data?.signedUrl ?? null
  }

  const attendanceRecords = (attendance ?? []) as AttendanceRecord[]

  type StagePerformanceRow = { role: string | null; stage_performances: { id: string; title: string; performed_at: string; venue: string | null } | null }
  const sortedStagePerformances = ((stagePerformances ?? []) as unknown as StagePerformanceRow[])
    .filter(r => r.stage_performances)
    .sort((a, b) => (b.stage_performances!.performed_at).localeCompare(a.stage_performances!.performed_at))

  const stagePerformanceIds = sortedStagePerformances.map(r => r.stage_performances!.id)
  const { data: stageVideos } = stagePerformanceIds.length
    ? await supabase.from('stage_performance_videos').select('performance_id, url, label').in('performance_id', stagePerformanceIds).order('display_order')
    : { data: [] }
  const stageVideoMap = new Map<string, { url: string; label: string | null }[]>()
  for (const v of stageVideos ?? []) {
    const list = stageVideoMap.get(v.performance_id) ?? []
    list.push({ url: v.url, label: v.label })
    stageVideoMap.set(v.performance_id, list)
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <BackButton fallbackHref="/students" />
        <h1 className="text-2xl font-bold text-gray-800">{student.name}</h1>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${student.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {student.is_active ? '在籍' : '休会'}
        </span>
        {student.subsidy_program && (
          <span title={student.subsidy_program} className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
            助成: {student.subsidy_program}
          </span>
        )}
        {student.family_group && (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
            {student.family_group}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Link href={`/students?edit=${student.id}`} className="px-3 py-1.5 rounded-lg text-sm font-medium text-indigo-600 border border-indigo-200 hover:bg-indigo-50">
            編集
          </Link>
          <StudentQrCode studentName={student.name} qrToken={student.qr_token} />
        </div>
      </div>

      {familyMembers.length > 0 && (
        <div className="mb-4 flex items-center gap-2 flex-wrap text-sm">
          <span className="text-gray-400 text-xs">ご家族:</span>
          {familyMembers.map(m => (
            <Link key={m.id} href={`/students/${m.id}`}
              className={`px-2 py-0.5 rounded-full text-xs font-medium hover:underline ${m.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'}`}>
              {m.name}
            </Link>
          ))}
        </div>
      )}

      <div className="grid md:grid-cols-[1fr_240px] gap-4 mb-4 items-start">
        <div className="grid sm:grid-cols-[200px_1fr] gap-4">
          <div className="bg-white rounded-xl shadow-sm p-5 flex flex-col items-center justify-center">
            {avatarSignedUrl ? (
              <img src={avatarSignedUrl} alt={student.name} className="w-full aspect-[3/4] rounded-xl object-contain bg-gray-50 shadow-sm" />
            ) : (
              <div className="w-full aspect-[3/4] rounded-xl bg-gray-100 flex items-center justify-center text-gray-300 text-7xl font-bold">
                {student.name?.charAt(0) ?? '?'}
              </div>
            )}
          </div>

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
                ['住所', [student.address1, student.address2, student.address3].filter(Boolean).join(' ') || student.address],
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

        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><Theater size={16} className="text-indigo-500" /> 舞台出演履歴</h2>
          {sortedStagePerformances.length === 0 ? (
            <p className="text-gray-400 text-sm">出演記録がありません</p>
          ) : (
            <ul className="space-y-3">
              {sortedStagePerformances.map((r, i) => {
                const p = r.stage_performances!
                const videos = stageVideoMap.get(p.id) ?? []
                return (
                  <li key={i}>
                    <Link href={`/stages`} className="block hover:bg-gray-50 -mx-2 px-2 py-1 rounded-lg transition-colors">
                      <div className="text-xs text-indigo-500 font-medium">
                        {new Date(p.performed_at + 'T00:00:00').toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </div>
                      <div className="text-sm font-medium text-gray-800">{p.title}</div>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                        {p.venue && <span className="flex items-center gap-1"><MapPin size={11} /> {p.venue}</span>}
                        {r.role && <span className="text-gray-400">演目・役割: {r.role}</span>}
                      </div>
                    </Link>
                    {videos.length > 0 && (
                      <div className="flex gap-2 overflow-x-auto mt-2 pb-1 pl-1 scrollbar-none">
                        {videos.map((v, vi) => (
                          <VideoThumb key={vi} url={v.url} label={v.label} size="w-24" />
                        ))}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <StudentKarteSection studentId={id} initialRecords={records ?? []} />

        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="font-semibold text-gray-700 mb-3">
            出席履歴
            {attendanceRecords.length > 0 && (
              <span className="ml-2 text-xs font-normal text-gray-400">全{attendanceRecords.length}件</span>
            )}
          </h2>
          {student.is_active ? (
            <AttendanceCalendar records={attendanceRecords} />
          ) : (
            <AttendanceList records={attendanceRecords} />
          )}
        </div>
      </div>
    </div>
  )
}
