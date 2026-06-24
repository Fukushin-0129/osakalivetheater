'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Lesson, Student, Attendance } from '@/types/database'
import { ClipboardCheck, UserCheck, UserX, Clock, Ban, CheckCheck, Loader2, ChevronLeft, ChevronRight, JapaneseYen, Check, X, ArrowLeftRight, Plus, Trash2, Pencil } from 'lucide-react'

const STATUS_OPTIONS = [
  { value: 'present',     label: '出席',       icon: UserCheck, active: 'bg-green-500 text-white',   inactive: 'bg-gray-100 text-gray-400 hover:bg-green-50 hover:text-green-600' },
  { value: 'late',        label: '遅刻',       icon: Clock,     active: 'bg-yellow-400 text-white',  inactive: 'bg-gray-100 text-gray-400 hover:bg-yellow-50 hover:text-yellow-600' },
  { value: 'absent',      label: '欠席',       icon: UserX,     active: 'bg-red-400 text-white',     inactive: 'bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-500' },
  { value: 'cancelled',   label: 'キャンセル', icon: Ban,       active: 'bg-gray-400 text-white',    inactive: 'bg-gray-100 text-gray-400 hover:bg-gray-200' },
  { value: 'substituted', label: '振替',       icon: ArrowLeftRight, active: 'bg-purple-500 text-white', inactive: 'bg-gray-100 text-gray-400 hover:bg-purple-50 hover:text-purple-600' },
] as const

type StatusValue = typeof STATUS_OPTIONS[number]['value']

type StudentSub = {
  id: string
  student_id: string
  original_lesson_id: string
  substitute_lesson_id: string | null
  notes: string | null
}

const CASH_CATEGORIES = ['レッスン収入', '体験レッスン収入', '出演収入', '入会金', '発表会参加費', 'グッズ販売', 'その他']

type CashItem = { category: string; amount: string }
type SavedCashItem = { id: string; category: string; amount: number }

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

  // 現金入力UI状態（開閉・入力中の値のみ。保存済みはsavedCashに分離）
  const [cashOpen, setCashOpen] = useState<Record<string, boolean>>({})
  const [cashItems, setCashItemsState] = useState<Record<string, CashItem[]>>({})
  const [cashSaving, setCashSaving] = useState<Record<string, boolean>>({})
  // 保存済み現金: キー = `${lessonId}:${studentId}`、レッスン切り替えで消えない
  const [savedCash, setSavedCash] = useState<Record<string, SavedCashItem[]>>({})
  // 現金編集モーダル
  const [editCashKey, setEditCashKey] = useState<string | null>(null) // `${lessonId}:${studentId}`
  const [editCashItems, setEditCashItems] = useState<CashItem[]>([])
  const [editCashSaving, setEditCashSaving] = useState(false)

  // 振替状態
  const [subsAsOriginal, setSubsAsOriginal] = useState<StudentSub[]>([])
  const [subsAsSubstitute, setSubsAsSubstitute] = useState<StudentSub[]>([])
  const [subModalStudentId, setSubModalStudentId] = useState<string | null>(null)
  const [subLessonId, setSubLessonId] = useState('')
  const [subNotes, setSubNotes] = useState('')
  const [subSaving, setSubSaving] = useState(false)

  const supabase = createClient()

  // 初回ロード: レッスン・生徒・過去の現金取引を一括取得
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
      supabase.from('transactions').select('*')
        .eq('type', 'income')
        .like('description', '現金受取 -%')
        .gte('transaction_date', from.toISOString().slice(0, 10))
        .lte('transaction_date', to.toISOString().slice(0, 10)),
    ]).then(([{ data: l }, { data: s }, { data: txns }]) => {
      const ls = l ?? []
      const sts = s ?? []
      setLessons(ls)
      setStudents(sts)

      // 現金取引をlessonId:studentIdキーでマップ化
      if (txns && txns.length > 0 && ls.length > 0 && sts.length > 0) {
        // 日付→レッスンIDのマップ（同日複数レッスンは最初の1つ）
        const dateToLessons: Record<string, Lesson[]> = {}
        for (const lesson of ls) {
          const date = lesson.scheduled_at.slice(0, 10)
          if (!dateToLessons[date]) dateToLessons[date] = []
          dateToLessons[date].push(lesson)
        }
        const cashMap: Record<string, SavedCashItem[]> = {}
        for (const txn of txns) {
          const matchedStudent = sts.find(st => txn.description?.startsWith(`現金受取 - ${st.name}（`))
          if (!matchedStudent) continue
          const dayLessons = dateToLessons[txn.transaction_date] ?? []
          const matchedLesson = dayLessons.find(l => txn.description?.includes(`（${l.title}）`)) ?? dayLessons[0]
          if (!matchedLesson) continue
          const key = `${matchedLesson.id}:${matchedStudent.id}`
          if (!cashMap[key]) cashMap[key] = []
          cashMap[key].push({ id: txn.id, category: txn.category, amount: txn.amount })
        }
        setSavedCash(cashMap)
      }

      if (ls.length > 0) {
        const now = new Date()
        const upcoming = ls.find(lesson => parseJST(lesson.scheduled_at) >= now)
        const nearest = upcoming ?? ls[ls.length - 1]
        setSelectedLesson(nearest.id)
      }
    })
  }, [])

  useEffect(() => {
    if (!selectedLesson) { setAttendance({}); setSubsAsOriginal([]); setSubsAsSubstitute([]); return }
    setLoadingLesson(true)
    Promise.all([
      supabase.from('attendance').select('*').eq('lesson_id', selectedLesson),
      supabase.from('student_substitutions').select('*').eq('original_lesson_id', selectedLesson),
      supabase.from('student_substitutions').select('*').eq('substitute_lesson_id', selectedLesson),
    ]).then(([{ data: att }, { data: orig }, { data: sub }]) => {
      const map: Record<string, Attendance> = {}
      for (const a of att ?? []) map[a.student_id] = a
      setAttendance(map)
      setSubsAsOriginal(orig ?? [])
      setSubsAsSubstitute(sub ?? [])
      setLoadingLesson(false)
    })
  }, [selectedLesson])

  const currentIndex = useMemo(() => lessons.findIndex(l => l.id === selectedLesson), [lessons, selectedLesson])

  function goPrev() { if (currentIndex > 0) setSelectedLesson(lessons[currentIndex - 1].id) }
  function goNext() { if (currentIndex < lessons.length - 1) setSelectedLesson(lessons[currentIndex + 1].id) }

  async function setStatus(studentId: string, status: StatusValue) {
    if (!selectedLesson) return
    // 振替ボタンはモーダルで設定するためここでは処理しない
    if (status === 'substituted') { openSubModal(studentId); return }
    setSavingId(studentId)
    const existing = attendance[studentId]
    if (existing) {
      if (existing.status === status) {
        await supabase.from('attendance').delete().eq('id', existing.id)
        setAttendance(prev => { const n = { ...prev }; delete n[studentId]; return n })
      } else {
        await supabase.from('attendance').update({ status }).eq('id', existing.id)
        setAttendance(prev => ({ ...prev, [studentId]: { ...prev[studentId], status } as unknown as Attendance }))
      }
    } else {
      const { data } = await supabase.from('attendance').insert({ lesson_id: selectedLesson, student_id: studentId, status }).select().single()
      if (data) setAttendance(prev => ({ ...prev, [studentId]: data }))
    }
    setSavingId(null)
  }

  function openSubModal(studentId: string) {
    const existing = subsAsOriginal.find(s => s.student_id === studentId)
    setSubLessonId(existing?.substitute_lesson_id ?? '')
    setSubNotes(existing?.notes ?? '')
    setSubModalStudentId(studentId)
  }

  async function saveSubstitution() {
    if (!subModalStudentId || !subLessonId || !selectedLesson) return
    setSubSaving(true)

    // 出席ステータスを「振替」に更新
    const existing = attendance[subModalStudentId]
    if (existing) {
      await supabase.from('attendance').update({ status: 'substituted' }).eq('id', existing.id)
    } else {
      const { data } = await supabase.from('attendance').insert({
        lesson_id: selectedLesson,
        student_id: subModalStudentId,
        status: 'substituted',
      }).select().single()
      if (data) setAttendance(prev => ({ ...prev, [subModalStudentId]: data }))
    }
    setAttendance(prev => ({ ...prev, [subModalStudentId]: { ...prev[subModalStudentId], status: 'substituted' } as unknown as Attendance }))

    // student_substitutions をupsert
    await supabase.from('student_substitutions').upsert({
      student_id: subModalStudentId,
      original_lesson_id: selectedLesson,
      substitute_lesson_id: subLessonId,
      notes: subNotes || null,
    }, { onConflict: 'student_id,original_lesson_id' })

    // ローカル状態を更新
    setSubsAsOriginal(prev => {
      const filtered = prev.filter(s => s.student_id !== subModalStudentId)
      return [...filtered, { id: '', student_id: subModalStudentId, original_lesson_id: selectedLesson, substitute_lesson_id: subLessonId, notes: subNotes || null }]
    })

    setSubSaving(false)
    setSubModalStudentId(null)
  }

  async function removeSubstitution(studentId: string) {
    if (!confirm('この生徒の振替設定を解除しますか？')) return
    await supabase.from('student_substitutions').delete()
      .eq('student_id', studentId).eq('original_lesson_id', selectedLesson)
    // 出席ステータスも欠席に戻す
    const existing = attendance[studentId]
    if (existing) {
      await supabase.from('attendance').update({ status: 'absent' }).eq('id', existing.id)
      setAttendance(prev => ({ ...prev, [studentId]: { ...prev[studentId], status: 'absent' } as unknown as Attendance }))
    }
    setSubsAsOriginal(prev => prev.filter(s => s.student_id !== studentId))
  }

  function toggleCash(studentId: string) {
    setCashOpen(prev => ({ ...prev, [studentId]: !prev[studentId] }))
    setCashItemsState(prev => {
      if (prev[studentId]) return prev
      return { ...prev, [studentId]: [{ category: 'レッスン収入', amount: '' }] }
    })
  }

  function setCashItem(studentId: string, idx: number, field: 'category' | 'amount', value: string) {
    setCashItemsState(prev => {
      const items = [...(prev[studentId] ?? [])]
      items[idx] = { ...items[idx], [field]: value }
      return { ...prev, [studentId]: items }
    })
  }

  function addCashItem(studentId: string) {
    setCashItemsState(prev => ({
      ...prev,
      [studentId]: [...(prev[studentId] ?? []), { category: 'レッスン収入', amount: '' }],
    }))
  }

  function removeCashItem(studentId: string, idx: number) {
    setCashItemsState(prev => {
      const items = (prev[studentId] ?? []).filter((_, i) => i !== idx)
      return { ...prev, [studentId]: items.length ? items : [{ category: 'レッスン収入', amount: '' }] }
    })
  }

  async function saveCash(studentId: string, studentName: string) {
    const items = cashItems[studentId] ?? []
    const validItems = items.filter(it => parseInt(it.amount, 10) > 0)
    if (!validItems.length) return
    const lessonData = lessons.find(l => l.id === selectedLesson)
    const lessonDate = lessonData ? lessonData.scheduled_at.slice(0, 10) : new Date().toISOString().slice(0, 10)
    setCashSaving(prev => ({ ...prev, [studentId]: true }))
    const rows = validItems.map(it => ({
      transaction_date: lessonDate,
      type: 'income' as const,
      category: it.category,
      amount: parseInt(it.amount, 10),
      description: `現金受取 - ${studentName}（${lessonData?.title ?? 'レッスン'}）`,
    }))
    const { data: inserted, error: insertError } = await supabase.from('transactions').insert(rows).select('id, category, amount')
    if (insertError) {
      alert(`保存エラー: ${insertError.message}`)
      setCashSaving(prev => ({ ...prev, [studentId]: false }))
      return
    }
    const newSaved: SavedCashItem[] = (inserted ?? []).map(r => ({ id: r.id, category: r.category, amount: r.amount }))
    const key = `${selectedLesson}:${studentId}`
    setSavedCash(prev => ({ ...prev, [key]: [...(prev[key] ?? []), ...newSaved] }))
    setCashOpen(prev => ({ ...prev, [studentId]: false }))
    setCashItemsState(prev => ({ ...prev, [studentId]: [{ category: 'レッスン収入', amount: '' }] }))
    setCashSaving(prev => ({ ...prev, [studentId]: false }))
  }

  function openEditCash(lessonId: string, studentId: string) {
    const key = `${lessonId}:${studentId}`
    const saved = savedCash[key] ?? []
    setEditCashKey(key)
    setEditCashItems(saved.map(it => ({ category: it.category, amount: String(it.amount) })))
  }

  async function saveEditCash(studentId: string, studentName: string) {
    if (!editCashKey) return
    const saved = savedCash[editCashKey] ?? []
    const validItems = editCashItems.filter(it => parseInt(it.amount, 10) > 0)
    setEditCashSaving(true)

    // 既存トランザクションを削除
    const oldIds = saved.map(it => it.id)
    if (oldIds.length > 0) {
      await supabase.from('transactions').delete().in('id', oldIds)
    }

    if (validItems.length > 0) {
      const lessonData = lessons.find(l => l.id === selectedLesson)
      const lessonDate = lessonData ? lessonData.scheduled_at.slice(0, 10) : new Date().toISOString().slice(0, 10)
      const rows = validItems.map(it => ({
        transaction_date: lessonDate,
        type: 'income' as const,
        category: it.category,
        amount: parseInt(it.amount, 10),
        description: `現金受取 - ${studentName}（${lessonData?.title ?? 'レッスン'}）`,
      }))
      const { data: inserted } = await supabase.from('transactions').insert(rows).select('id, category, amount')
      const newSaved: SavedCashItem[] = (inserted ?? []).map(r => ({ id: r.id, category: r.category, amount: r.amount }))
      setSavedCash(prev => ({ ...prev, [editCashKey]: newSaved }))
    } else {
      setSavedCash(prev => { const n = { ...prev }; delete n[editCashKey!]; return n })
    }

    setEditCashSaving(false)
    setEditCashKey(null)
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
      substituted: vals.filter(a => a.status === 'substituted').length,
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

  const subModalStudent = students.find(s => s.id === subModalStudentId)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">出席管理</h1>
          <p className="text-gray-500 text-sm mt-0.5">レッスンを選んで出席を記録</p>
        </div>
        {selectedLesson && students.length > 0 && (
          <button onClick={markAllPresent}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-xl text-sm font-medium shadow-sm transition-colors">
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
                <div className="flex flex-wrap gap-3 text-sm">
                  <span className="text-green-700 font-medium">出席 {counts.present}</span>
                  <span className="text-yellow-600 font-medium">遅刻 {counts.late}</span>
                  <span className="text-red-500 font-medium">欠席 {counts.absent}</span>
                  {counts.substituted > 0 && <span className="text-purple-600 font-medium">振替 {counts.substituted}</span>}
                  {counts.unmarked > 0 && <span className="text-gray-400">未記録 {counts.unmarked}</span>}
                </div>
              </div>
              {/* このレッスンへの振替出席者 */}
              {subsAsSubstitute.length > 0 && (
                <div className="mt-3 pt-3 border-t border-indigo-200">
                  <p className="text-xs text-indigo-500 font-medium mb-1.5">他レッスンからの振替出席:</p>
                  <div className="flex flex-wrap gap-2">
                    {subsAsSubstitute.map(sub => {
                      const stu = students.find(s => s.id === sub.student_id)
                      const origLesson = lessons.find(l => l.id === sub.original_lesson_id)
                      return (
                        <span key={sub.id} className="inline-flex items-center gap-1 text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                          <ArrowLeftRight size={10} />
                          {stu?.name ?? '不明'}
                          {origLesson && <span className="opacity-70">（{parseJST(origLesson.scheduled_at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}分）</span>}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}
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
                  {[...students].sort((a, b) => {
                    const statusOrder = (id: string) => {
                      const status = attendance[id]?.status
                      if (status === 'present') return 0
                      if (status === 'late') return 1
                      if (status === 'substituted') return 2
                      if (status === 'absent') return 3
                      if (status === 'cancelled') return 4
                      return 5 // unmarked
                    }
                    return statusOrder(a.id) - statusOrder(b.id)
                  }).map(s => {
                    const a = attendance[s.id]
                    const isSaving = savingId === s.id
                    const isOpen = cashOpen[s.id] ?? false
                    const items = cashItems[s.id] ?? [{ category: 'レッスン収入', amount: '' }]
                    const isCashSaving = cashSaving[s.id] ?? false
                    const cashKey = `${selectedLesson}:${s.id}`
                    const savedItems = savedCash[cashKey] ?? []
                    const subRecord = subsAsOriginal.find(sub => sub.student_id === s.id)
                    const subLesson = subRecord?.substitute_lesson_id ? lessons.find(l => l.id === subRecord.substitute_lesson_id) : null
                    const isSubstituteHere = subsAsSubstitute.some(sub => sub.student_id === s.id)

                    return (
                      <tr key={s.id} className={`hover:bg-gray-50 transition-colors ${isSubstituteHere ? 'bg-purple-50/30' : ''}`}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-800">{s.name}</div>
                          {s.name_kana && <div className="text-xs text-gray-400">{s.name_kana}</div>}
                          {isSubstituteHere && (
                            <span className="inline-flex items-center gap-1 text-xs text-purple-600 mt-0.5">
                              <ArrowLeftRight size={9} /> 振替出席
                            </span>
                          )}
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
                          {a?.status === 'substituted' && (
                            <div className="mt-1.5 flex items-center gap-2">
                              {subLesson ? (
                                <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                                  → {parseJST(subLesson.scheduled_at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' })} に振替
                                </span>
                              ) : (
                                <span className="text-xs text-purple-400">振替先未設定</span>
                              )}
                              <button onClick={() => openSubModal(s.id)} className="text-xs text-purple-500 hover:text-purple-700 underline">変更</button>
                              <button onClick={() => removeSubstitution(s.id)} className="text-xs text-gray-400 hover:text-red-500 underline">解除</button>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isOpen ? (
                            <div className="flex flex-col gap-1.5 py-0.5 min-w-[220px]">
                              {items.map((item, idx) => (
                                <div key={idx} className="flex items-center gap-1">
                                  <select value={item.category}
                                    onChange={e => setCashItem(s.id, idx, 'category', e.target.value)}
                                    className="flex-1 border border-gray-200 rounded-lg px-1.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-green-400 bg-white min-w-0">
                                    {CASH_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                  </select>
                                  <span className="text-gray-400 text-xs flex-shrink-0">¥</span>
                                  <input type="number" min="0" value={item.amount}
                                    onChange={e => setCashItem(s.id, idx, 'amount', e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') saveCash(s.id, s.name); if (e.key === 'Escape') toggleCash(s.id) }}
                                    placeholder="金額"
                                    className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-green-400 flex-shrink-0"
                                    autoFocus={idx === 0} />
                                  {items.length > 1 && (
                                    <button onClick={() => removeCashItem(s.id, idx)} className="text-gray-300 hover:text-red-400 flex-shrink-0 p-0.5">
                                      <Trash2 size={11} />
                                    </button>
                                  )}
                                </div>
                              ))}
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <button onClick={() => addCashItem(s.id)}
                                  className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800 px-1.5 py-0.5 rounded border border-green-200 hover:bg-green-50">
                                  <Plus size={11} /> 追加
                                </button>
                                <div className="flex-1" />
                                <button onClick={() => saveCash(s.id, s.name)}
                                  disabled={isCashSaving || !items.some(it => parseInt(it.amount, 10) > 0)}
                                  className="text-green-600 hover:text-green-800 p-1 disabled:opacity-40">
                                  {isCashSaving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                                </button>
                                <button onClick={() => toggleCash(s.id)} className="text-gray-400 hover:text-gray-600 p-1"><X size={13} /></button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1">
                              {savedItems.length > 0 && (
                                <div className="flex flex-col gap-0.5">
                                  {savedItems.map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full w-fit">
                                      <Check size={10} />
                                      <span>{item.category} ¥{item.amount.toLocaleString()}</span>
                                    </div>
                                  ))}
                                  <button onClick={() => openEditCash(selectedLesson, s.id)}
                                    className="text-xs text-indigo-500 hover:text-indigo-700 underline text-left w-fit mt-0.5">
                                    修正する
                                  </button>
                                </div>
                              )}
                              <button onClick={() => toggleCash(s.id)}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all bg-gray-100 text-gray-400 hover:bg-green-50 hover:text-green-600 w-fit">
                                <JapaneseYen size={12} />
                                {savedItems.length > 0 ? '追加入力' : '現金'}
                              </button>
                            </div>
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
                {counts.substituted > 0 && <span className="text-purple-600 font-medium">⇆ 振替 {counts.substituted}名</span>}
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

      {/* 振替設定モーダル */}
      {subModalStudentId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-base font-bold text-gray-800">振替設定</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {subModalStudent?.name} ／ 振替元: {selectedLessonData && parseJST(selectedLessonData.scheduled_at).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })}
                </p>
              </div>
              <button onClick={() => setSubModalStudentId(null)} className="text-gray-400 hover:text-gray-600 p-1"><X size={20} /></button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">振替先レッスン *</label>
                <select value={subLessonId} onChange={e => setSubLessonId(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
                  <option value="">振替先を選択</option>
                  {lessons.filter(l => l.id !== selectedLesson).map(l => (
                    <option key={l.id} value={l.id}>{formatLesson(l)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">メモ（任意）</label>
                <input value={subNotes} onChange={e => setSubNotes(e.target.value)}
                  placeholder="例: 旅行のため"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setSubModalStudentId(null)} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50">キャンセル</button>
              <button onClick={saveSubstitution} disabled={subSaving || !subLessonId}
                className="flex-1 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white py-2.5 rounded-xl text-sm font-medium">
                {subSaving && <Loader2 size={14} className="animate-spin" />}
                {subSaving ? '保存中...' : '振替を設定'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 現金修正モーダル */}
      {editCashKey && (() => {
        const studentId = editCashKey.split(':')[1]
        const student = students.find(s => s.id === studentId)
        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <div>
                  <h2 className="text-base font-bold text-gray-800">現金収入を修正</h2>
                  <p className="text-xs text-gray-500 mt-0.5">{student?.name}</p>
                </div>
                <button onClick={() => setEditCashKey(null)} className="text-gray-400 hover:text-gray-600 p-1"><X size={20} /></button>
              </div>
              <div className="px-6 py-4 space-y-2">
                {editCashItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select value={item.category}
                      onChange={e => setEditCashItems(prev => prev.map((it, i) => i === idx ? { ...it, category: e.target.value } : it))}
                      className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
                      {CASH_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <span className="text-gray-400 text-sm">¥</span>
                    <input type="number" min="0" value={item.amount}
                      onChange={e => setEditCashItems(prev => prev.map((it, i) => i === idx ? { ...it, amount: e.target.value } : it))}
                      className="w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                    <button onClick={() => setEditCashItems(prev => prev.filter((_, i) => i !== idx))}
                      className="text-gray-300 hover:text-red-400 p-0.5"><Trash2 size={14} /></button>
                  </div>
                ))}
                <button onClick={() => setEditCashItems(prev => [...prev, { category: 'レッスン収入', amount: '' }])}
                  className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded border border-indigo-200 hover:bg-indigo-50 mt-1">
                  <Plus size={12} /> 費目を追加
                </button>
                {editCashItems.length === 0 && (
                  <p className="text-xs text-red-400 mt-1">全件削除されます。「更新する」で確定します。</p>
                )}
              </div>
              <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
                <button onClick={() => setEditCashKey(null)} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50">キャンセル</button>
                <button onClick={() => saveEditCash(studentId, student?.name ?? '')}
                  disabled={editCashSaving}
                  className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white py-2.5 rounded-xl text-sm font-medium">
                  {editCashSaving && <Loader2 size={14} className="animate-spin" />}
                  {editCashSaving ? '保存中...' : '更新する'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
