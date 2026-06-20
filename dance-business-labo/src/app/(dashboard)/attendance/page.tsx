'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Lesson, Student, Attendance } from '@/types/database'
import { ClipboardCheck, UserCheck, UserX, Clock, Ban, CheckCheck, Loader2, ChevronLeft, ChevronRight, JapaneseYen, Check, X } from 'lucide-react'

const STATUS_OPTIONS = [
  { value: 'present',   label: '出席',       icon: UserCheck, active: 'bg-green-500 text-white',  inactive: 'bg-gray-100 text-gray-400 hover:bg-green-50 hover:text-green-600' },
  { value: 'late',      label: '遅刻',       icon: Clock,     active: 'bg-yellow-400 text-white', inactive: 'bg-gray-100 text-gray-400 hover:bg-yellow-50 hover:text-yellow-600' },
  { value: 'absent',    label: '欠席',       icon: UserX,     active: 'bg-red-400 text-white',    inactive: 'bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-500' },
  { value: 'cancelled', label: 'キャンセル', icon: Ban,       active: 'bg-gray-400 text-white',   inactive: 'bg-gray-100 text-gray-400 hover:bg-gray-200' },
] as const

type StatusValue = typeof STATUS_OPTIONS[number]['value']

function parseJST(s: string): Date {
  const clean = s.slice(0, 16).replace(' ', 'T')
  const [y, m, d] = clean.slice(0, 10).split('-').map(Number)
  const [h, min] = clean.slice(11).split(':').map(Number)
  return new Date(y, m - 1, d, h, min)
}

function formatLesson(l: Lesson) {
  return parseJST(l.scheduled_at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' }) + ' ' + l.title
}

export default function AttendancePage() {
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [selectedLesson, setSelectedLesson] = useState<string>('')
  const [attendance, setAttendance] = useState<Record<string, Attendance>>({})
  const [loadingLesson, setLoadingLesson] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)

  // 現金入力状態: studentId → { open, amount, saving, saved }
  const [cashState, setCashState] = useState<Record<string, { open: boolean; amount: string; saving: boolean; saved: boolean }>>({})

  const supabase = createClient()

  useEffect(() => {
    const from = new Date()
    from.setFullYear(from.getFullYear() - 1)
    const to = new Date()
    to.setFullYear(to.getFullYear() + 2)

    Promise.all([
      supabase.from('lessons').select('*')
        .gte('scheduled_at', from.toISOString())
        .lte('scheduled_at', to.toISOString())
        .order('scheduled_at', { ascending: true }),
      supabase.from('students').select('*').eq('is_active', true).order('name_kana'),
    ]).then(([{ data: l }, { data: s }]) => {
      const ls = l ?? []
      setLessons(ls)
      setStudents(s ?? [])
      if (ls.length > 0) {
        const now = new Date()
        const upcoming = ls.find(lesson => parseJST(lesson.scheduled_at) >= now)
        const nearest = upcoming ?? ls[ls.length - 1]
        setSelectedLesson(nearest.id)
      }
    })
  }, [])

  useEffect(() => {
    if (!selectedLesson) { setAttendance({}); return }
    setLoadingLesson(true)
    setCashState({})
    supabase.from('attendance').select('*').eq('lesson_id', selectedLesson).then(({ data }) => {
      const map: Record<string, Attendance> = {}
      for (const a of data ?? []) map[a.student_id] = a
      setAttendance(map)
      setLoadingLesson(false)
    })
  }, [selectedLesson])

  const currentIndex = useMemo(() => lessons.findIndex(l => l.id === selectedLesson), [lessons, selectedLesson])

  function goPrev() { if (currentIndex > 0) setSelectedLesson(lessons[currentIndex - 1].id) }
  function goNext() { if (currentIndex < lessons.length - 1) setSelectedLesson(lessons[currentIndex + 1].id) }

  async function setStatus(studentId: string, status: StatusValue) {
    if (!selectedLesson) return
    setSavingId(studentId)
    const existing = attendance[studentId]
    if (existing) {
      if (existing.status === status) {
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

  function toggleCash(studentId: string) {
    setCashState(prev => {
      const cur = prev[studentId]
      if (cur?.open) return { ...prev, [studentId]: { ...cur, open: false } }
      return { ...prev, [studentId]: { open: true, amount: '', saving: false, saved: false } }
    })
  }

  async function saveCash(studentId: string, studentName: string) {
    const cs = cashState[studentId]
    const amount = parseInt(cs?.amount ?? '', 10)
    if (!amount || amount <= 0) return
    const lessonData = lessons.find(l => l.id === selectedLesson)
    const lessonDate = lessonData ? lessonData.scheduled_at.slice(0, 10) : new Date().toISOString().slice(0, 10)

    setCashState(prev => ({ ...prev, [studentId]: { ...prev[studentId], saving: true } }))
    const { error } = await supabase.from('transactions').insert({
      transaction_date: lessonDate,
      type: 'income',
      category: 'レッスン収入',
      amount,
      description: `現金受取 - ${studentName}（${lessonData?.title ?? 'レッスン'}）`,
    })
    if (error) {
      alert(`保存エラー: ${error.message}`)
      setCashState(prev => ({ ...prev, [studentId]: { ...prev[studentId], saving: false } }))
      return
    }
    setCashState(prev => ({ ...prev, [studentId]: { open: false, amount: '', saving: false, saved: true } }))
    // 3秒後にsaved表示をリセット
    setTimeout(() => {
      setCashState(prev => ({ ...prev, [studentId]: { ...prev[studentId], saved: false } }))
    }, 3000)
  }

  async function markAllPresent() {
    if (!selectedLesson || !confirm(`全員（${students.length}名）を出席にしますか？`)) return
    const upserts = students.map(s => ({ lesson_id: selectedLesson, student_id: s.id, status: 'present' as StatusValue }))
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

  const groupedLessons = useMemo(() => {
    const groups: Record<string, Lesson[]> = {}
    for (const l of [...lessons].reverse()) {
      const key = l.scheduled_at.slice(0, 7)
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

      {/* レッスン選択 + 前後ナビ */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <label className="block text-xs font-medium text-gray-600 mb-1.5">レッスンを選択</label>
        <div className="flex items-center gap-2">
          <button onClick={goPrev} disabled={currentIndex <= 0}
            className="flex-shrink-0 p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            <ChevronLeft size={18} />
          </button>
          <select value={selectedLesson} onChange={e => setSelectedLesson(e.target.value)}
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">-- レッスンを選んでください --</option>
            {Object.entries(groupedLessons).map(([month, ls]) => (
              <optgroup key={month} label={`${month.replace('-', '年')}月`}>
                {ls.map(l => <option key={l.id} value={l.id}>{formatLesson(l)}</option>)}
              </optgroup>
            ))}
          </select>
          <button onClick={goNext} disabled={currentIndex >= lessons.length - 1}
            className="flex-shrink-0 p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            <ChevronRight size={18} />
          </button>
        </div>
        {lessons.length > 0 && currentIndex >= 0 && (
          <p className="text-xs text-gray-400 mt-1.5 text-right">{currentIndex + 1} / {lessons.length} 件</p>
        )}
      </div>

      {selectedLesson && (
        <>
          {selectedLessonData && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-semibold text-indigo-800">{selectedLessonData.title}</div>
                  <div className="text-indigo-600 text-sm mt-0.5">
                    {parseJST(selectedLessonData.scheduled_at).toLocaleString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' })}
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
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 w-32">生徒名</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">出席状態</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 w-40">現金受取</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {students.map(s => {
                    const a = attendance[s.id]
                    const isSaving = savingId === s.id
                    const cs = cashState[s.id]
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
                                  <button key={opt.value} onClick={() => setStatus(s.id, opt.value)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${isActive ? opt.active : opt.inactive}`}>
                                    <Icon size={12} />
                                    {opt.label}
                                  </button>
                                )
                              })
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {cs?.open ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-gray-400 text-xs">¥</span>
                              <input
                                type="number"
                                min="0"
                                value={cs.amount}
                                onChange={e => setCashState(prev => ({ ...prev, [s.id]: { ...prev[s.id], amount: e.target.value } }))}
                                onKeyDown={e => { if (e.key === 'Enter') saveCash(s.id, s.name); if (e.key === 'Escape') toggleCash(s.id) }}
                                placeholder="金額"
                                className="w-24 border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-green-400"
                                autoFocus
                              />
                              <button onClick={() => saveCash(s.id, s.name)} disabled={cs.saving || !cs.amount}
                                className="text-green-600 hover:text-green-800 p-1 disabled:opacity-40">
                                {cs.saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                              </button>
                              <button onClick={() => toggleCash(s.id)} className="text-gray-400 hover:text-gray-600 p-1">
                                <X size={13} />
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => toggleCash(s.id)}
                              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                                cs?.saved
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-100 text-gray-400 hover:bg-green-50 hover:text-green-600'
                              }`}>
                              <JapaneseYen size={12} />
                              {cs?.saved ? '記録済み' : '現金'}
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}

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
