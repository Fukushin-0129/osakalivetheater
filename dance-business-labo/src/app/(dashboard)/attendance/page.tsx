'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Lesson, Student, Attendance } from '@/types/database'
import { ClipboardCheck, UserCheck, UserX, Clock, Ban, CheckCheck, Loader2 } from 'lucide-react'

const STATUS_OPTIONS = [
  { value: 'present',   label: '出席',       icon: UserCheck, active: 'bg-green-500 text-white',  inactive: 'bg-gray-100 text-gray-400 hover:bg-green-50 hover:text-green-600' },
  { value: 'late',      label: '遅刻',       icon: Clock,     active: 'bg-yellow-400 text-white', inactive: 'bg-gray-100 text-gray-400 hover:bg-yellow-50 hover:text-yellow-600' },
  { value: 'absent',    label: '欠席',       icon: UserX,     active: 'bg-red-400 text-white',    inactive: 'bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-500' },
  { value: 'cancelled', label: 'キャンセル', icon: Ban,       active: 'bg-gray-400 text-white',   inactive: 'bg-gray-100 text-gray-400 hover:bg-gray-200' },
] as const

type StatusValue = typeof STATUS_OPTIONS[number]['value']

export default function AttendancePage() {
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [selectedLesson, setSelectedLesson] = useState<string>('')
  const [attendance, setAttendance] = useState<Record<string, Attendance>>({})
  const [loadingLesson, setLoadingLesson] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    Promise.all([
      supabase.from('lessons').select('*').order('scheduled_at', { ascending: false }).limit(50),
      supabase.from('students').select('*').eq('is_active', true).order('name_kana'),
    ]).then(([{ data: l }, { data: s }]) => {
      setLessons(l ?? [])
      setStudents(s ?? [])
    })
  }, [])

  useEffect(() => {
    if (!selectedLesson) { setAttendance({}); return }
    setLoadingLesson(true)
    supabase.from('attendance').select('*').eq('lesson_id', selectedLesson).then(({ data }) => {
      const map: Record<string, Attendance> = {}
      for (const a of data ?? []) map[a.student_id] = a
      setAttendance(map)
      setLoadingLesson(false)
    })
  }, [selectedLesson])

  async function setStatus(studentId: string, status: StatusValue) {
    if (!selectedLesson) return
    setSavingId(studentId)
    const existing = attendance[studentId]
    if (existing) {
      if (existing.status === status) {
        // 同じボタンを押したら削除（トグル）
        await supabase.from('attendance').delete().eq('id', existing.id)
        setAttendance(prev => { const n = { ...prev }; delete n[studentId]; return n })
      } else {
        await supabase.from('attendance').update({ status }).eq('id', existing.id)
        setAttendance(prev => ({ ...prev, [studentId]: { ...prev[studentId], status } }))
      }
    } else {
      const { data } = await supabase.from('attendance').insert({ lesson_id: selectedLesson, student_id: studentId, status }).select().single()
      if (data) setAttendance(prev => ({ ...prev, [studentId]: data }))
    }
    setSavingId(null)
  }

  async function markAllPresent() {
    if (!selectedLesson || !confirm(`全員（${students.length}名）を出席にしますか？`)) return
    const upserts = students.map(s => ({
      lesson_id: selectedLesson,
      student_id: s.id,
      status: 'present' as StatusValue,
    }))
    await supabase.from('attendance').upsert(upserts, { onConflict: 'lesson_id,student_id' })
    const { data } = await supabase.from('attendance').select('*').eq('lesson_id', selectedLesson)
    const map: Record<string, Attendance> = {}
    for (const a of data ?? []) map[a.student_id] = a
    setAttendance(map)
  }

  const selectedLessonData = useMemo(() => lessons.find(l => l.id === selectedLesson), [lessons, selectedLesson])

  const counts = useMemo(() => {
    const vals = Object.values(attendance)
    return {
      present: vals.filter(a => a.status === 'present').length,
      late: vals.filter(a => a.status === 'late').length,
      absent: vals.filter(a => a.status === 'absent').length,
      cancelled: vals.filter(a => a.status === 'cancelled').length,
      unmarked: students.length - vals.length,
    }
  }, [attendance, students])

  // 月ごとにレッスンをグループ化
  const groupedLessons = useMemo(() => {
    const groups: Record<string, Lesson[]> = {}
    for (const l of lessons) {
      const key = l.scheduled_at.slice(0, 7) // YYYY-MM
      if (!groups[key]) groups[key] = []
      groups[key].push(l)
    }
    return groups
  }, [lessons])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">出席管理</h1>
          <p className="text-gray-500 text-sm mt-0.5">レッスンを選んで出席を記録</p>
        </div>
        {selectedLesson && students.length > 0 && (
          <button
            onClick={markAllPresent}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-xl text-sm font-medium shadow-sm transition-colors"
          >
            <CheckCheck size={15} /> 全員出席
          </button>
        )}
      </div>

      {/* レッスン選択 */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <label className="block text-xs font-medium text-gray-600 mb-1.5">レッスンを選択</label>
        <select
          value={selectedLesson}
          onChange={e => setSelectedLesson(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">-- レッスンを選んでください --</option>
          {Object.entries(groupedLessons).map(([month, ls]) => (
            <optgroup key={month} label={`${month.replace('-', '年')}月`}>
              {ls.map(l => (
                <option key={l.id} value={l.id}>
                  {new Date(l.scheduled_at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' })} {l.title}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {selectedLesson && (
        <>
          {/* レッスン情報＋集計 */}
          {selectedLessonData && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-semibold text-indigo-800">{selectedLessonData.title}</div>
                  <div className="text-indigo-600 text-sm mt-0.5">
                    {new Date(selectedLessonData.scheduled_at).toLocaleString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                    {selectedLessonData.location && <span className="ml-2">📍{selectedLessonData.location}</span>}
                  </div>
                </div>
                <div className="flex gap-3 text-sm">
                  <span className="text-green-700 font-medium">出席 {counts.present}</span>
                  <span className="text-yellow-600 font-medium">遅刻 {counts.late}</span>
                  <span className="text-red-500 font-medium">欠席 {counts.absent}</span>
                  {counts.unmarked > 0 && <span className="text-gray-400">未記録 {counts.unmarked}</span>}
                </div>
              </div>
            </div>
          )}

          {/* 出席テーブル */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {loadingLesson ? (
              <div className="flex items-center justify-center py-12 text-gray-400">
                <Loader2 size={22} className="animate-spin mr-2" /> 読み込み中...
              </div>
            ) : students.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <ClipboardCheck size={28} className="mx-auto mb-2 opacity-30" />
                在籍中の生徒がいません
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">生徒名</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">出席状態</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {students.map(s => {
                    const a = attendance[s.id]
                    const isSaving = savingId === s.id
                    return (
                      <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-800">{s.name}</div>
                          {s.name_kana && <div className="text-xs text-gray-400">{s.name_kana}</div>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            {isSaving ? (
                              <Loader2 size={16} className="animate-spin text-indigo-400 my-1" />
                            ) : (
                              STATUS_OPTIONS.map(opt => {
                                const Icon = opt.icon
                                const isActive = a?.status === opt.value
                                return (
                                  <button
                                    key={opt.value}
                                    onClick={() => setStatus(s.id, opt.value)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${isActive ? opt.active : opt.inactive}`}
                                  >
                                    <Icon size={12} />
                                    {opt.label}
                                  </button>
                                )
                              })
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}

            {/* フッター集計 */}
            {!loadingLesson && students.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex flex-wrap gap-3 text-xs">
                <span className="text-green-600 font-medium">✓ 出席 {counts.present}名</span>
                <span className="text-yellow-600 font-medium">⏰ 遅刻 {counts.late}名</span>
                <span className="text-red-500 font-medium">✗ 欠席 {counts.absent}名</span>
                <span className="text-gray-400 font-medium">🚫 キャンセル {counts.cancelled}名</span>
                {counts.unmarked > 0 && <span className="text-gray-300 font-medium">— 未記録 {counts.unmarked}名</span>}
              </div>
            )}
          </div>
        </>
      )}

      {!selectedLesson && (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-400">
          <ClipboardCheck size={36} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">上のセレクトからレッスンを選んでください</p>
        </div>
      )}
    </div>
  )
}
