'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Lesson, LessonType } from '@/types/database'
import { Plus, Pencil, Trash2, Calendar, List, ChevronLeft, ChevronRight, Clock, MapPin, Users, X, Loader2, Download, BookOpen, ArrowLeftRight } from 'lucide-react'
import Link from 'next/link'

type ViewMode = 'list' | 'calendar'
type AttendanceWithStudent = { count: number; students: { name: string; name_kana: string | null } | null; status: string }
type LessonWithCount = Lesson & { lesson_types: LessonType | null; attendance: AttendanceWithStudent[] }
type AttendeeInfo = { id: string; student_id: string; status: string; students: { name: string; name_kana: string | null } | null }
type AttendeeModal = { lessonId: string; lessonTitle: string; lessonDate: string } | null
type SubRecord = { id: string; original_lesson_id: string; substitute_lesson_id: string | null; reason: string | null; price_difference: number; notes: string | null }

const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
const DEFAULT_LOCATION = '山田ふれあい文化センター練習室'
const DEFAULT_TIMES = ['19:00', '20:15']

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

// DBに保存されたタイムスタンプはタイムゾーンなし文字列として扱い、
// そのまま日本時間として解釈する（UTC変換しない）
function parseJST(s: string): Date {
  const clean = s.slice(0, 16).replace(' ', 'T')
  const [y, m, d] = clean.slice(0, 10).split('-').map(Number)
  const [h, min] = clean.slice(11).split(':').map(Number)
  return new Date(y, m - 1, d, h, min)
}

function todayStr() {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

export default function LessonsPage() {
  const [lessons, setLessons] = useState<LessonWithCount[]>([])
  const [lessonTypes, setLessonTypes] = useState<LessonType[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [attendeeModal, setAttendeeModal] = useState<AttendeeModal>(null)
  const [attendees, setAttendees] = useState<AttendeeInfo[]>([])
  const [loadingAttendees, setLoadingAttendees] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importDates, setImportDates] = useState<string[]>([])
  const [importSelected, setImportSelected] = useState<Set<string>>(new Set())
  const [importTimes, setImportTimes] = useState<Set<string>>(new Set(DEFAULT_TIMES))
  const [importTimeOptions, setImportTimeOptions] = useState<string[]>(DEFAULT_TIMES)
  const [newImportTime, setNewImportTime] = useState('')
  const [importTitle, setImportTitle] = useState('タップダンスレッスン')
  const [loadingImport, setLoadingImport] = useState(false)
  const [editing, setEditing] = useState<Lesson | null>(null)
  // 振替
  const [substitutions, setSubstitutions] = useState<SubRecord[]>([])
  const [subModal, setSubModal] = useState<LessonWithCount | null>(null)
  const [subForm, setSubForm] = useState({ substitute_date: '', substitute_time: '19:00', reason: '先生の都合', price_difference: '0', notes: '' })
  const [subSaving, setSubSaving] = useState(false)

  const [calendarDate, setCalendarDate] = useState(new Date())
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [yearRange, setYearRange] = useState<number[]>([])
  const [form, setForm] = useState({
    title: '',
    lesson_type_id: '',
    scheduled_at: '',
    location: '',
    max_capacity: '20',
    notes: '',
  })
  const supabase = createClient()

  async function loadYears() {
    const [{ data: first }, { data: last }] = await Promise.all([
      supabase.from('lessons').select('scheduled_at').order('scheduled_at', { ascending: true }).limit(1),
      supabase.from('lessons').select('scheduled_at').order('scheduled_at', { ascending: false }).limit(1),
    ])
    if (first?.[0] && last?.[0]) {
      const minYear = parseJST(first[0].scheduled_at).getFullYear()
      const maxYear = parseJST(last[0].scheduled_at).getFullYear()
      const years: number[] = []
      for (let y = minYear; y <= maxYear; y++) years.push(y)
      setYearRange(years)
    }
  }

  async function load(year = selectedYear) {
    setLoading(true)
    const start = `${year}-01-01T00:00:00`
    const end = `${year + 1}-01-01T00:00:00`
    const [{ data: l }, { data: lt }] = await Promise.all([
      supabase.from('lessons').select('*, lesson_types(*), attendance(status, students(name, name_kana))').gte('scheduled_at', start).lt('scheduled_at', end).order('scheduled_at', { ascending: true }),
      supabase.from('lesson_types').select('*').order('name'),
    ])
    setLessons((l ?? []) as LessonWithCount[])
    setLessonTypes(lt ?? [])
    // 振替データも読み込む
    const { data: subs } = await supabase.from('lesson_substitutions').select('*')
    setSubstitutions(subs ?? [])
    setLoading(false)
  }

  useEffect(() => { loadYears(); load() }, [])

  function changeYear(year: number) {
    setSelectedYear(year)
    load(year)
  }

  function openNew() {
    setEditing(null)
    setForm({ title: 'タップダンスレッスン', lesson_type_id: '', scheduled_at: `${todayStr()}T19:00`, location: DEFAULT_LOCATION, max_capacity: '20', notes: '' })
    setShowModal(true)
  }

  function openEdit(l: Lesson) {
    setEditing(l)
    setForm({
      title: l.title,
      lesson_type_id: l.lesson_type_id ?? '',
      scheduled_at: l.scheduled_at.slice(0, 16),
      location: l.location ?? '',
      max_capacity: String(l.max_capacity),
      notes: l.notes ?? '',
    })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.title.trim() || !form.scheduled_at) return
    setSaving(true)
    const payload = {
      title: form.title,
      lesson_type_id: form.lesson_type_id || null,
      scheduled_at: form.scheduled_at,
      location: form.location || null,
      max_capacity: Number(form.max_capacity),
      notes: form.notes || null,
    }
    if (editing) {
      await supabase.from('lessons').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('lessons').insert(payload)
    }
    setSaving(false)
    setShowModal(false)
    load()
  }

  async function openImport() {
    setLoadingImport(true)
    setShowImportModal(true)
    const today = todayStr()
    // lesson_date は専用カラムなのでDB側で今日以降に絞り込める（過去の大量データを読み込まずに済む）
    const { data: txData } = await supabase
      .from('transactions')
      .select('lesson_date')
      .eq('category', 'レッスン場代')
      .gte('lesson_date', today)

    const lessonDates = new Set<string>()
    for (const tx of txData ?? []) {
      if (tx.lesson_date) lessonDates.add(tx.lesson_date as string)
    }

    const existingDates = new Set(lessons.map(l => l.scheduled_at.slice(0, 10)))
    const unregistered = [...lessonDates]
      .filter(d => !existingDates.has(d))
      .sort()

    setImportDates(unregistered)
    setImportSelected(new Set(unregistered))
    setLoadingImport(false)
  }

  async function handleImport() {
    if (importSelected.size === 0 || importTimes.size === 0) return
    setSaving(true)
    const rows: { title: string; scheduled_at: string; location: string; max_capacity: number }[] = []
    for (const date of [...importSelected].sort()) {
      for (const time of [...importTimes].sort()) {
        rows.push({
          title: importTitle,
          scheduled_at: `${date}T${time}`,
          location: DEFAULT_LOCATION,
          max_capacity: 20,
        })
      }
    }
    await supabase.from('lessons').insert(rows)
    setSaving(false)
    setShowImportModal(false)
    load()
  }

  async function openAttendees(l: LessonWithCount) {
    const dt = parseJST(l.scheduled_at)
    setAttendeeModal({
      lessonId: l.id,
      lessonTitle: l.title,
      lessonDate: dt.toLocaleString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' }),
    })
    setLoadingAttendees(true)
    const sorted = [...(l.attendance ?? [])].sort((a, b) => a.status.localeCompare(b.status))
    setAttendees(sorted.map((a, i) => ({ id: String(i), student_id: '', status: a.status, students: a.students })))
    setLoadingAttendees(false)
  }

  function openSubModal(l: LessonWithCount) {
    const existing = substitutions.find(s => s.original_lesson_id === l.id)
    const existingSubLesson = existing?.substitute_lesson_id ? lessons.find(ll => ll.id === existing.substitute_lesson_id) : null
    setSubForm({
      substitute_date: existingSubLesson ? existingSubLesson.scheduled_at.slice(0, 10) : '',
      substitute_time: existingSubLesson ? parseJST(existingSubLesson.scheduled_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false }) : '19:00',
      reason: existing?.reason ?? '先生の都合',
      price_difference: String(existing?.price_difference ?? 0),
      notes: existing?.notes ?? '',
    })
    setSubModal(l)
  }

  async function handleSubSave() {
    if (!subModal || !subForm.substitute_date || !subForm.substitute_time) return
    setSubSaving(true)
    const priceDiff = parseInt(subForm.price_difference) || 0
    const originalLesson = subModal
    const scheduledAt = `${subForm.substitute_date}T${subForm.substitute_time}`

    // 振替先レッスンが既存か確認し、なければ自動作成
    let subLessonId: string
    const existingLesson = lessons.find(l => l.scheduled_at.slice(0, 16) === scheduledAt)
    if (existingLesson) {
      subLessonId = existingLesson.id
    } else {
      const { data: newLesson } = await supabase.from('lessons').insert({
        title: originalLesson.title,
        scheduled_at: scheduledAt,
        location: originalLesson.location ?? DEFAULT_LOCATION,
        max_capacity: originalLesson.max_capacity ?? 20,
        notes: subForm.reason ? `振替レッスン（${subForm.reason}）` : '振替レッスン',
      }).select().single()
      if (!newLesson) { alert('振替先レッスンの作成に失敗しました'); setSubSaving(false); return }
      subLessonId = newLesson.id
    }

    // 既存の振替を削除してから再挿入
    const existing = substitutions.find(s => s.original_lesson_id === subModal.id)
    if (existing) {
      await supabase.from('lesson_substitutions').delete().eq('id', existing.id)
    }
    await supabase.from('lesson_substitutions').insert({
      original_lesson_id: subModal.id,
      substitute_lesson_id: subLessonId,
      reason: subForm.reason || null,
      price_difference: priceDiff,
      notes: subForm.notes || null,
    })

    // 差額を収支に計上
    if (priceDiff !== 0) {
      const origDate = parseJST(originalLesson.scheduled_at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })
      const subDateLabel = new Date(subForm.substitute_date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })
      await supabase.from('transactions').insert({
        transaction_date: subForm.substitute_date,
        type: priceDiff > 0 ? 'income' : 'expense',
        category: '振替差額',
        amount: Math.abs(priceDiff),
        description: `振替差額（${origDate} → ${subDateLabel}）${subForm.reason ? ' ' + subForm.reason : ''}`,
      })
    }

    setSubSaving(false)
    setSubModal(null)
    load()
  }

  async function handleSubDelete(lessonId: string) {
    if (!confirm('振替設定を解除しますか？')) return
    const existing = substitutions.find(s => s.original_lesson_id === lessonId)
    if (existing) await supabase.from('lesson_substitutions').delete().eq('id', existing.id)
    load()
  }

  async function handleDelete(l: Lesson) {
    if (!confirm(`「${l.title}」を削除しますか？\n出席記録も削除されます。`)) return
    await supabase.from('lessons').delete().eq('id', l.id)
    load()
  }

  const calYear = calendarDate.getFullYear()
  const calMonth = calendarDate.getMonth()

  const calendarLessons = useMemo(() => {
    const map: Record<string, Lesson[]> = {}
    for (const l of lessons) {
      const d = parseJST(l.scheduled_at)
      if (d.getFullYear() === calYear && d.getMonth() === calMonth) {
        const key = d.getDate().toString()
        if (!map[key]) map[key] = []
        map[key].push(l)
      }
    }
    return map
  }, [lessons, calYear, calMonth])

  const calendarDays = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1).getDay()
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
    return { firstDay, daysInMonth }
  }, [calYear, calMonth])

  const groupedLessons = useMemo(() => {
    const groups: Record<string, LessonWithCount[]> = {}
    for (const l of lessons) {
      const key = l.scheduled_at.slice(0, 7)
      if (!groups[key]) groups[key] = []
      groups[key].push(l)
    }
    return groups
  }, [lessons])

  const today = new Date()
  const todayMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const allMonths = Object.keys(groupedLessons).sort()
  const futureMonths = allMonths.filter(m => m >= todayMonth)
  const pastMonths = allMonths.filter(m => m < todayMonth).reverse()
  const nearestMonth = futureMonths[0] ?? pastMonths[0]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">レッスン管理</h1>
          <p className="text-gray-500 text-sm mt-0.5">全 {lessons.length} 件</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
              title="リスト表示"
            >
              <List size={16} />
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'calendar' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
              title="カレンダー表示"
            >
              <Calendar size={16} />
            </button>
          </div>
          <button
            onClick={openImport}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-sm transition-colors"
          >
            <Download size={16} /> 場代から登録
          </button>
          <button
            onClick={openNew}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-sm transition-colors"
          >
            <Plus size={16} /> 新規作成
          </button>
        </div>
      </div>

      {/* 年タブ */}
      {yearRange.length > 0 && (
        <div className="flex gap-1 overflow-x-auto pb-1 mb-4 scrollbar-none">
          {[...yearRange].reverse().map(year => (
            <button
              key={year}
              onClick={() => changeYear(year)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                year === selectedYear
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-gray-500 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {year}年
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm flex items-center justify-center py-20 text-gray-400">
          <Loader2 size={24} className="animate-spin mr-2" /> 読み込み中...
        </div>
      ) : viewMode === 'calendar' ? (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <button onClick={() => setCalendarDate(new Date(calYear, calMonth - 1, 1))} className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500">
              <ChevronLeft size={18} />
            </button>
            <h2 className="text-base font-bold text-gray-800">{calYear}年 {calMonth + 1}月</h2>
            <button onClick={() => setCalendarDate(new Date(calYear, calMonth + 1, 1))} className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500">
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="grid grid-cols-7 border-b border-gray-100">
            {WEEKDAYS.map((d, i) => (
              <div key={d} className={`text-center py-2 text-xs font-semibold ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-500'}`}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: calendarDays.firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="border-b border-r border-gray-50 min-h-[80px] bg-gray-50/50" />
            ))}
            {Array.from({ length: calendarDays.daysInMonth }).map((_, i) => {
              const day = i + 1
              const dayLessons = calendarLessons[day.toString()] ?? []
              const isToday = today.getFullYear() === calYear && today.getMonth() === calMonth && today.getDate() === day
              const colIndex = (calendarDays.firstDay + i) % 7
              return (
                <div key={day} className={`border-b border-r border-gray-100 min-h-[80px] p-1 ${isToday ? 'bg-indigo-50' : ''}`}>
                  <div className={`text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-indigo-600 text-white' : colIndex === 0 ? 'text-red-400' : colIndex === 6 ? 'text-blue-400' : 'text-gray-600'}`}>
                    {day}
                  </div>
                  <div className="space-y-0.5">
                    {dayLessons.map(l => (
                      <button key={l.id} onClick={() => openEdit(l)} className="w-full text-left px-1.5 py-0.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded text-xs leading-tight truncate transition-colors" title={l.title}>
                        {parseJST(l.scheduled_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} {l.title}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {allMonths.length === 0 && (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-400">
              <Calendar size={36} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm">レッスンが登録されていません</p>
            </div>
          )}
          {/* 今月以降: 昇順 */}
          {futureMonths.map(month => {
            const ls = groupedLessons[month]
            const isNearToday = month === nearestMonth
            return (
              <div key={month} id={`month-${month}`}>
                <h2 className={`text-sm font-semibold mb-2 px-1 flex items-center gap-2 ${isNearToday ? 'text-indigo-600' : 'text-gray-500'}`}>
                  {month.replace('-', '年')}月
                  {isNearToday && <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">今月</span>}
                </h2>
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-gray-50">
                      {ls.map(l => {
                        const dt = parseJST(l.scheduled_at)
                        const isPast = dt < today
                        const isToday = dt.toDateString() === today.toDateString()
                        const lt = l.lesson_types as LessonType | null
                        const presentList = l.attendance?.filter(a => a.status === 'present' || a.status === 'late') ?? []
                        const attendCount = presentList.length
                        const cap = l.max_capacity ?? 0
                        return (
                          <tr key={l.id} className={`hover:bg-gray-50 transition-colors ${isPast && !isToday ? 'opacity-60' : ''} ${isToday ? 'bg-indigo-50/50' : ''}`}>
                            <td className="px-4 py-3 w-28 text-gray-500 text-xs whitespace-nowrap align-top">
                              <div className={`font-medium ${isToday ? 'text-indigo-600' : 'text-gray-700'}`}>
                                {dt.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                                （{WEEKDAYS[dt.getDay()]}）
                              </div>
                              <div className="flex items-center gap-1 mt-0.5 text-gray-400">
                                <Clock size={11} />
                                {dt.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </td>
                            <td className="px-4 py-3 align-top">
                              <div className="font-medium text-gray-800">{l.title}</div>
                              {lt && <span className="inline-block mt-0.5 px-2 py-0.5 bg-indigo-50 text-indigo-600 text-xs rounded-full">{lt.name}</span>}
                            </td>
                            <td className="px-4 py-3 hidden md:table-cell align-top">
                              {l.location && <div className="flex items-center gap-1 text-gray-500 text-xs"><MapPin size={12} /> {l.location}</div>}
                            </td>
                            <td className="px-4 py-3 align-top">
                              <button onClick={() => openAttendees(l)} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-600 transition-colors mb-1.5" title="クリックで参加者詳細を表示">
                                <Users size={12} className="flex-shrink-0" />
                                <span className="font-semibold">{attendCount}</span>
                                <span className="text-gray-400">/ {cap}名</span>
                              </button>
                              <div className="flex flex-wrap gap-1">
                                {presentList.map((a, i) => (
                                  <span key={i} className="inline-block px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">{a.students?.name ?? '—'}</span>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              {(() => {
                                const sub = substitutions.find(s => s.original_lesson_id === l.id)
                                const subLesson = sub ? lessons.find(ll => ll.id === sub.substitute_lesson_id) : null
                                const isSub = substitutions.some(s => s.substitute_lesson_id === l.id)
                                const origLesson = isSub ? lessons.find(ll => substitutions.find(s => s.substitute_lesson_id === l.id && s.original_lesson_id === ll.id)) : null
                                return (
                                  <>
                                    {sub && subLesson && (
                                      <span className="inline-flex items-center gap-1 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full mr-2">
                                        <ArrowLeftRight size={10} />
                                        {parseJST(subLesson.scheduled_at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}へ振替
                                      </span>
                                    )}
                                    {isSub && origLesson && (
                                      <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full mr-2">
                                        <ArrowLeftRight size={10} />
                                        {parseJST(origLesson.scheduled_at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}の振替
                                      </span>
                                    )}
                                  </>
                                )
                              })()}
                              <Link href={`/lessons/${l.id}`} className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 mr-1 px-2 py-1 rounded-lg hover:bg-indigo-50 transition-colors font-medium"><BookOpen size={13} /> 計画・評価</Link>
                              {l.plan_status === 'planned' && (
                                <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full mr-2">
                                  ✓ 計画済
                                </span>
                              )}
                              <button onClick={() => openSubModal(l)} className="text-gray-400 hover:text-orange-500 mr-1 p-1.5 rounded hover:bg-orange-50 transition-colors" title="振替設定"><ArrowLeftRight size={14} /></button>
                              <button onClick={() => openEdit(l)} className="text-gray-400 hover:text-indigo-600 mr-1 p-1.5 rounded hover:bg-indigo-50 transition-colors"><Pencil size={14} /></button>
                              <button onClick={() => handleDelete(l)} className="text-gray-400 hover:text-red-500 p-1.5 rounded hover:bg-red-50 transition-colors"><Trash2 size={14} /></button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
          {/* 先月以前: 降順 */}
          {pastMonths.length > 0 && (
            <div className={futureMonths.length > 0 ? 'border-t border-dashed border-gray-200 pt-4' : ''}>
              {futureMonths.length > 0 && <p className="text-xs text-gray-400 mb-4 px-1">過去のレッスン</p>}
              {pastMonths.map(month => {
                const ls = [...groupedLessons[month]].reverse()
                const isNearToday = month === nearestMonth
                return (
                  <div key={month} id={`month-${month}`} className="mb-6">
                    <h2 className={`text-sm font-semibold mb-2 px-1 flex items-center gap-2 ${isNearToday ? 'text-indigo-600' : 'text-gray-500'}`}>
                      {month.replace('-', '年')}月
                      {isNearToday && <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">今月</span>}
                    </h2>
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden opacity-70">
                      <table className="w-full text-sm">
                        <tbody className="divide-y divide-gray-50">
                          {ls.map(l => {
                            const dt = parseJST(l.scheduled_at)
                            const lt = l.lesson_types as LessonType | null
                            const presentList = l.attendance?.filter(a => a.status === 'present' || a.status === 'late') ?? []
                            const attendCount = presentList.length
                            const cap = l.max_capacity ?? 0
                            return (
                              <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-3 w-28 text-gray-500 text-xs whitespace-nowrap align-top">
                                  <div className="font-medium text-gray-500">
                                    {dt.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                                    （{WEEKDAYS[dt.getDay()]}）
                                  </div>
                                  <div className="flex items-center gap-1 mt-0.5 text-gray-400">
                                    <Clock size={11} />
                                    {dt.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                </td>
                                <td className="px-4 py-3 align-top">
                                  <div className="font-medium text-gray-600">{l.title}</div>
                                  {lt && <span className="inline-block mt-0.5 px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">{lt.name}</span>}
                                </td>
                                <td className="px-4 py-3 hidden md:table-cell align-top">
                                  {l.location && <div className="flex items-center gap-1 text-gray-400 text-xs"><MapPin size={12} /> {l.location}</div>}
                                </td>
                                <td className="px-4 py-3 align-top">
                                  <button onClick={() => openAttendees(l)} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-indigo-600 transition-colors mb-1.5">
                                    <Users size={12} className="flex-shrink-0" />
                                    <span className="font-semibold">{attendCount}</span>
                                    <span className="text-gray-300">/ {cap}名</span>
                                  </button>
                                  <div className="flex flex-wrap gap-1">
                                    {presentList.map((a, i) => (
                                      <span key={i} className="inline-block px-1.5 py-0.5 bg-gray-50 text-gray-400 text-xs rounded">{a.students?.name ?? '—'}</span>
                                    ))}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right whitespace-nowrap">
                                  {(() => {
                                    const sub = substitutions.find(s => s.original_lesson_id === l.id)
                                    const subLesson = sub ? lessons.find(ll => ll.id === sub.substitute_lesson_id) : null
                                    const isSub = substitutions.some(s => s.substitute_lesson_id === l.id)
                                    const origLesson = isSub ? lessons.find(ll => substitutions.find(s => s.substitute_lesson_id === l.id && s.original_lesson_id === ll.id)) : null
                                    return (
                                      <>
                                        {sub && subLesson && (
                                          <span className="inline-flex items-center gap-1 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full mr-2">
                                            <ArrowLeftRight size={10} />
                                            {parseJST(subLesson.scheduled_at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}へ振替
                                          </span>
                                        )}
                                        {isSub && origLesson && (
                                          <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full mr-2">
                                            <ArrowLeftRight size={10} />
                                            {parseJST(origLesson.scheduled_at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}の振替
                                          </span>
                                        )}
                                      </>
                                    )
                                  })()}
                                  {l.plan_status === 'planned' && (
                                    <span className="inline-flex items-center gap-1 text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full mr-2">
                                      ✓ 計画済
                                    </span>
                                  )}
                                  <Link href={`/lessons/${l.id}`} className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-600 mr-1 px-2 py-1 rounded-lg hover:bg-indigo-50 transition-colors"><BookOpen size={13} /> 計画・評価</Link>
                                  <button onClick={() => openSubModal(l)} className="text-gray-300 hover:text-orange-500 mr-1 p-1.5 rounded hover:bg-orange-50 transition-colors" title="振替設定"><ArrowLeftRight size={14} /></button>
                                  <button onClick={() => openEdit(l)} className="text-gray-300 hover:text-indigo-600 mr-1 p-1.5 rounded hover:bg-indigo-50 transition-colors"><Pencil size={14} /></button>
                                  <button onClick={() => handleDelete(l)} className="text-gray-300 hover:text-red-500 p-1.5 rounded hover:bg-red-50 transition-colors"><Trash2 size={14} /></button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <h2 className="text-lg font-bold text-gray-800">場代データからレッスン登録</h2>
              <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-gray-600 p-1"><X size={20} /></button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
              {loadingImport ? (
                <div className="flex items-center justify-center py-10 text-gray-400"><Loader2 size={20} className="animate-spin mr-2" /> 読み込み中...</div>
              ) : (
                <>
                  <div>
                    <label className="text-xs font-medium text-gray-600">レッスン名</label>
                    <input value={importTitle} onChange={e => setImportTitle(e.target.value)} className={`mt-1 ${inputCls}`} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">作成する時間帯</label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {importTimeOptions.map(t => (
                        <div key={t} className={`flex items-center rounded-xl border overflow-hidden ${importTimes.has(t) ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-gray-200'}`}>
                          <button
                            type="button"
                            onClick={() => {
                              const next = new Set(importTimes)
                              next.has(t) ? next.delete(t) : next.add(t)
                              setImportTimes(next)
                            }}
                            className={`py-2 pl-3 pr-2 text-sm font-medium transition-colors ${importTimes.has(t) ? 'text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                          >
                            {t}〜
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setImportTimeOptions(prev => prev.filter(x => x !== t))
                              setImportTimes(prev => { const next = new Set(prev); next.delete(t); return next })
                            }}
                            title="この時間帯を選択肢から削除"
                            className={`p-2 transition-colors ${importTimes.has(t) ? 'text-indigo-200 hover:text-white hover:bg-indigo-700' : 'text-gray-300 hover:text-red-500 hover:bg-red-50'}`}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="time"
                        value={newImportTime}
                        onChange={e => setNewImportTime(e.target.value)}
                        className={`${inputCls} w-auto`}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!newImportTime || importTimeOptions.includes(newImportTime)) return
                          setImportTimeOptions(prev => [...prev, newImportTime].sort())
                          setImportTimes(prev => new Set([...prev, newImportTime]))
                          setNewImportTime('')
                        }}
                        className="flex items-center gap-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-xl font-medium"
                      >
                        <Plus size={12} /> 時間帯を追加
                      </button>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-medium text-gray-600">未登録のレッスン日（今日以降）</label>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setImportSelected(new Set(importDates))} className="text-xs text-indigo-600 hover:underline">全選択</button>
                        <button type="button" onClick={() => setImportSelected(new Set())} className="text-xs text-gray-400 hover:underline">全解除</button>
                      </div>
                    </div>
                    {importDates.length === 0 ? (
                      <p className="text-sm text-gray-400 py-4 text-center">未登録の今後のレッスン日はありません</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-1 max-h-60 overflow-y-auto border border-gray-100 rounded-xl p-2">
                        {importDates.map(date => {
                          const d = new Date(date)
                          const checked = importSelected.has(date)
                          return (
                            <label key={date} className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors ${checked ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50 text-gray-600'}`}>
                              <input type="checkbox" checked={checked} onChange={() => {
                                const next = new Set(importSelected)
                                checked ? next.delete(date) : next.add(date)
                                setImportSelected(next)
                              }} className="rounded" />
                              <span>{d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}（{WEEKDAYS[d.getDay()]}）</span>
                            </label>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  {importSelected.size > 0 && importTimes.size > 0 && (
                    <div className="bg-indigo-50 rounded-xl px-4 py-3 text-sm text-indigo-700">
                      {importSelected.size}日 × {importTimes.size}時間帯 = <span className="font-bold">{importSelected.size * importTimes.size}件</span>のレッスンを登録
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
              <button onClick={() => setShowImportModal(false)} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50">キャンセル</button>
              <button
                onClick={handleImport}
                disabled={saving || importSelected.size === 0 || importTimes.size === 0 || loadingImport}
                className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white py-2.5 rounded-xl text-sm font-medium"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? '登録中...' : `${importSelected.size * importTimes.size}件を登録`}
              </button>
            </div>
          </div>
        </div>
      )}

      {attendeeModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <div>
                <h2 className="text-base font-bold text-gray-800">{attendeeModal.lessonTitle}</h2>
                <p className="text-xs text-gray-500 mt-0.5">{attendeeModal.lessonDate}</p>
              </div>
              <button onClick={() => setAttendeeModal(null)} className="text-gray-400 hover:text-gray-600 p-1"><X size={20} /></button>
            </div>
            <div className="overflow-y-auto flex-1 px-4 py-3">
              {loadingAttendees ? (
                <div className="flex items-center justify-center py-10 text-gray-400"><Loader2 size={20} className="animate-spin mr-2" /> 読み込み中...</div>
              ) : attendees.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-8">参加者の記録がありません</p>
              ) : (
                <ul className="divide-y divide-gray-50">
                  {attendees.map(a => {
                    const statusColors: Record<string, string> = { present: 'bg-green-100 text-green-700', late: 'bg-yellow-100 text-yellow-700', absent: 'bg-red-100 text-red-600', cancelled: 'bg-gray-100 text-gray-500' }
                    const statusLabels: Record<string, string> = { present: '出席', late: '遅刻', absent: '欠席', cancelled: 'キャンセル' }
                    return (
                      <li key={a.id} className="flex items-center justify-between py-2.5">
                        <div>
                          <span className="text-sm font-medium text-gray-800">{a.students?.name ?? '不明'}</span>
                          {a.students?.name_kana && <span className="text-xs text-gray-400 ml-2">{a.students.name_kana}</span>}
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[a.status] ?? 'bg-gray-100 text-gray-500'}`}>
                          {statusLabels[a.status] ?? a.status}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
            <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-500 flex-shrink-0">
              {!loadingAttendees && `${attendees.filter(a => a.status === 'present').length}名出席 / ${attendees.filter(a => a.status === 'late').length}名遅刻 / ${attendees.filter(a => a.status === 'absent').length}名欠席`}
            </div>
          </div>
        </div>
      )}

      {subModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <div>
                <h2 className="text-lg font-bold text-gray-800">レッスン振替設定</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  振替元: {parseJST(subModal.scheduled_at).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <button onClick={() => setSubModal(null)} className="text-gray-400 hover:text-gray-600 p-1"><X size={20} /></button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">振替先の日付 *</label>
                <input
                  type="date"
                  value={subForm.substitute_date}
                  onChange={e => setSubForm(f => ({ ...f, substitute_date: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">振替先の時間 *</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {['19:00', '20:15'].map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSubForm(f => ({ ...f, substitute_time: t }))}
                      className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${subForm.substitute_time === t ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                    >{t}</button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setSubForm(f => ({ ...f, substitute_time: ['19:00','20:15'].includes(f.substitute_time) ? '' : f.substitute_time }))}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${!['19:00','20:15'].includes(subForm.substitute_time) ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                  >その他</button>
                  {!['19:00','20:15'].includes(subForm.substitute_time) && (
                    <input
                      type="text"
                      placeholder="例: 18:30"
                      value={subForm.substitute_time}
                      onChange={e => setSubForm(f => ({ ...f, substitute_time: e.target.value }))}
                      className={`${inputCls} w-28`}
                      autoFocus
                    />
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">振替理由</label>
                <input
                  value={subForm.reason}
                  onChange={e => setSubForm(f => ({ ...f, reason: e.target.value }))}
                  placeholder="例: 先生の都合、会場都合"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">差額（円）</label>
                <p className="text-xs text-gray-400 mb-1">振替先の方が高い場合は正の値、安い場合は負の値を入力。0なら収支に影響なし。</p>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-sm">¥</span>
                  <input
                    type="number"
                    value={subForm.price_difference}
                    onChange={e => setSubForm(f => ({ ...f, price_difference: e.target.value }))}
                    placeholder="0"
                    className={inputCls}
                  />
                </div>
                {parseInt(subForm.price_difference) !== 0 && (
                  <p className={`text-xs mt-1 font-medium ${parseInt(subForm.price_difference) > 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {parseInt(subForm.price_difference) > 0
                      ? `→ 収入として ¥${Math.abs(parseInt(subForm.price_difference)).toLocaleString()} を収支に計上`
                      : `→ 支出として ¥${Math.abs(parseInt(subForm.price_difference)).toLocaleString()} を収支に計上`}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">メモ</label>
                <textarea
                  value={subForm.notes}
                  onChange={e => setSubForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className={inputCls}
                  placeholder="備考など"
                />
              </div>
              {substitutions.find(s => s.original_lesson_id === subModal.id) && (
                <button
                  onClick={() => { handleSubDelete(subModal.id); setSubModal(null) }}
                  className="text-xs text-red-400 hover:text-red-600 underline"
                >
                  この振替設定を解除する
                </button>
              )}
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
              <button onClick={() => setSubModal(null)} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50">キャンセル</button>
              <button
                onClick={handleSubSave}
                disabled={subSaving || !subForm.substitute_date || !subForm.substitute_time}
                className="flex-1 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white py-2.5 rounded-xl text-sm font-medium"
              >
                {subSaving && <Loader2 size={14} className="animate-spin" />}
                {subSaving ? '保存中...' : '振替を設定'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <h2 className="text-lg font-bold text-gray-800">{editing ? 'レッスンを編集' : '新規レッスン作成'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 p-1"><X size={20} /></button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">レッスン名 *</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="例: タップダンスレッスン" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">レッスン種別</label>
                <select value={form.lesson_type_id} onChange={e => setForm(f => ({ ...f, lesson_type_id: e.target.value }))} className={inputCls}>
                  <option value="">選択しない</option>
                  {lessonTypes.map(lt => <option key={lt.id} value={lt.id}>{lt.name}（{lt.duration_minutes}分 / ¥{lt.price.toLocaleString()}）</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">日時 *</label>
                <input type="datetime-local" value={form.scheduled_at} onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))} className={inputCls} />
                <div className="flex gap-2 mt-2">
                  {DEFAULT_TIMES.map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, scheduled_at: `${f.scheduled_at.slice(0, 10)}T${t}` }))}
                      className="flex-1 py-1.5 text-xs rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-medium transition-colors"
                    >
                      {t}〜
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">場所</label>
                  <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="山田ふれあい文化センター練習室" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">定員</label>
                  <input type="number" min="1" value={form.max_capacity} onChange={e => setForm(f => ({ ...f, max_capacity: e.target.value }))} className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">メモ</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="持ち物・注意事項など" className={inputCls} />
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50">キャンセル</button>
              <button onClick={handleSave} disabled={saving || !form.title.trim() || !form.scheduled_at} className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white py-2.5 rounded-xl text-sm font-medium">
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? '保存中...' : editing ? '更新する' : '作成する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
