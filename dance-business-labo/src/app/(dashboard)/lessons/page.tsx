'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Lesson, LessonType } from '@/types/database'
import { Plus, Pencil, Trash2, Calendar, List, ChevronLeft, ChevronRight, Clock, MapPin, Users, X, Loader2 } from 'lucide-react'

type ViewMode = 'list' | 'calendar'

const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

export default function LessonsPage() {
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [lessonTypes, setLessonTypes] = useState<LessonType[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Lesson | null>(null)
  const [calendarDate, setCalendarDate] = useState(new Date())
  const [form, setForm] = useState({
    title: '',
    lesson_type_id: '',
    scheduled_at: '',
    location: '',
    max_capacity: '20',
    notes: '',
  })
  const supabase = createClient()

  async function load() {
    setLoading(true)
    const [{ data: l }, { data: lt }] = await Promise.all([
      supabase.from('lessons').select('*, lesson_types(*)').order('scheduled_at', { ascending: false }),
      supabase.from('lesson_types').select('*').order('name'),
    ])
    setLessons(l ?? [])
    setLessonTypes(lt ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openNew() {
    setEditing(null)
    setForm({ title: '', lesson_type_id: '', scheduled_at: '', location: '', max_capacity: '20', notes: '' })
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

  async function handleDelete(l: Lesson) {
    if (!confirm(`「${l.title}」を削除しますか？\n出席記録も削除されます。`)) return
    await supabase.from('lessons').delete().eq('id', l.id)
    load()
  }

  // カレンダー用データ
  const calYear = calendarDate.getFullYear()
  const calMonth = calendarDate.getMonth()

  const calendarLessons = useMemo(() => {
    const map: Record<string, Lesson[]> = {}
    for (const l of lessons) {
      const d = new Date(l.scheduled_at)
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

  // リスト用: 月ごとにグループ
  const groupedLessons = useMemo(() => {
    const groups: Record<string, Lesson[]> = {}
    const sorted = [...lessons].sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at))
    for (const l of sorted) {
      const key = l.scheduled_at.slice(0, 7)
      if (!groups[key]) groups[key] = []
      groups[key].push(l)
    }
    return groups
  }, [lessons])

  const today = new Date()

  return (
    <div>
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">レッスン管理</h1>
          <p className="text-gray-500 text-sm mt-0.5">全 {lessons.length} 件</p>
        </div>
        <div className="flex items-center gap-2">
          {/* ビュー切替 */}
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
            onClick={openNew}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-sm transition-colors"
          >
            <Plus size={16} /> 新規作成
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm flex items-center justify-center py-20 text-gray-400">
          <Loader2 size={24} className="animate-spin mr-2" /> 読み込み中...
        </div>
      ) : viewMode === 'calendar' ? (
        /* ===== カレンダービュー ===== */
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {/* カレンダーヘッダー */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <button
              onClick={() => setCalendarDate(new Date(calYear, calMonth - 1, 1))}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
            >
              <ChevronLeft size={18} />
            </button>
            <h2 className="text-base font-bold text-gray-800">
              {calYear}年 {calMonth + 1}月
            </h2>
            <button
              onClick={() => setCalendarDate(new Date(calYear, calMonth + 1, 1))}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* 曜日ヘッダー */}
          <div className="grid grid-cols-7 border-b border-gray-100">
            {WEEKDAYS.map((d, i) => (
              <div key={d} className={`text-center py-2 text-xs font-semibold ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-500'}`}>
                {d}
              </div>
            ))}
          </div>

          {/* カレンダーグリッド */}
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
                <div
                  key={day}
                  className={`border-b border-r border-gray-100 min-h-[80px] p-1 ${isToday ? 'bg-indigo-50' : ''}`}
                >
                  <div className={`text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                    isToday ? 'bg-indigo-600 text-white' : colIndex === 0 ? 'text-red-400' : colIndex === 6 ? 'text-blue-400' : 'text-gray-600'
                  }`}>
                    {day}
                  </div>
                  <div className="space-y-0.5">
                    {dayLessons.map(l => (
                      <button
                        key={l.id}
                        onClick={() => openEdit(l)}
                        className="w-full text-left px-1.5 py-0.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded text-xs leading-tight truncate transition-colors"
                        title={l.title}
                      >
                        {new Date(l.scheduled_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} {l.title}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        /* ===== リストビュー ===== */
        <div className="space-y-6">
          {Object.keys(groupedLessons).length === 0 && (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-400">
              <Calendar size={36} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm">レッスンが登録されていません</p>
            </div>
          )}
          {Object.entries(groupedLessons).map(([month, ls]) => (
            <div key={month}>
              <h2 className="text-sm font-semibold text-gray-500 mb-2 px-1">
                {month.replace('-', '年')}月
              </h2>
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-gray-50">
                    {ls.map(l => {
                      const dt = new Date(l.scheduled_at)
                      const isPast = dt < today
                      const lt = l.lesson_types as LessonType | null
                      return (
                        <tr key={l.id} className={`hover:bg-gray-50 transition-colors ${isPast ? 'opacity-60' : ''}`}>
                          <td className="px-4 py-3 w-28 text-gray-500 text-xs whitespace-nowrap">
                            <div className="font-medium text-gray-700">
                              {dt.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                              （{WEEKDAYS[dt.getDay()]}）
                            </div>
                            <div className="flex items-center gap-1 mt-0.5 text-gray-400">
                              <Clock size={11} />
                              {dt.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-800">{l.title}</div>
                            {lt && (
                              <span className="inline-block mt-0.5 px-2 py-0.5 bg-indigo-50 text-indigo-600 text-xs rounded-full">
                                {lt.name}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            {l.location && (
                              <div className="flex items-center gap-1 text-gray-500 text-xs">
                                <MapPin size={12} /> {l.location}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <div className="flex items-center gap-1 text-gray-400 text-xs">
                              <Users size={12} /> {l.max_capacity}名
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <button onClick={() => openEdit(l)} className="text-gray-400 hover:text-indigo-600 mr-1 p-1.5 rounded hover:bg-indigo-50 transition-colors">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => handleDelete(l)} className="text-gray-400 hover:text-red-500 p-1.5 rounded hover:bg-red-50 transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 追加・編集モーダル */}
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
                <input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="例: 初心者タップクラス"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">レッスン種別</label>
                <select
                  value={form.lesson_type_id}
                  onChange={e => setForm(f => ({ ...f, lesson_type_id: e.target.value }))}
                  className={inputCls}
                >
                  <option value="">選択しない</option>
                  {lessonTypes.map(lt => (
                    <option key={lt.id} value={lt.id}>{lt.name}（{lt.duration_minutes}分 / ¥{lt.price.toLocaleString()}）</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">日時 *</label>
                <input
                  type="datetime-local"
                  value={form.scheduled_at}
                  onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))}
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">場所</label>
                  <input
                    value={form.location}
                    onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                    placeholder="スタジオA"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">定員</label>
                  <input
                    type="number"
                    min="1"
                    value={form.max_capacity}
                    onChange={e => setForm(f => ({ ...f, max_capacity: e.target.value }))}
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">メモ</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  placeholder="持ち物・注意事項など"
                  className={inputCls}
                />
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50">
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.title.trim() || !form.scheduled_at}
                className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
              >
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
