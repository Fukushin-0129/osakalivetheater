'use client'

import { useEffect, useState, use } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Lesson, LessonType, CurriculumItem, LessonPlanItem, LessonEvaluation, Student } from '@/types/database'
import { ArrowLeft, Plus, Trash2, Star, ChevronDown, ChevronRight, Save, CheckCircle, Loader2, BookOpen, ClipboardList } from 'lucide-react'
import Link from 'next/link'

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']
const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'

type Tab = 'plan' | 'evaluation'

type AttendingStudent = { student_id: string; students: Student | null }

type EvalMap = Record<string, Record<string, { rating: number; notes: string }>>
// EvalMap[student_id][curriculum_item_id] = { rating, notes }

export default function LessonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: lessonId } = use(params)
  const supabase = createClient()

  const [tab, setTab] = useState<Tab>('plan')
  const [lesson, setLesson] = useState<(Lesson & { lesson_types: LessonType | null }) | null>(null)
  const [curriculumTree, setCurriculumTree] = useState<CurriculumItem[]>([])
  const [planItems, setPlanItems] = useState<LessonPlanItem[]>([])
  const [attendingStudents, setAttendingStudents] = useState<AttendingStudent[]>([])
  const [evalMap, setEvalMap] = useState<EvalMap>({})
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedEval, setSavedEval] = useState(false)
  const [newItemParent, setNewItemParent] = useState<{ parentId: string | null; level: number } | null>(null)
  const [newItemName, setNewItemName] = useState('')

  useEffect(() => { loadAll() }, [lessonId])

  async function loadAll() {
    setLoading(true)
    const [
      { data: lessonData },
      { data: currData },
      { data: planData },
      { data: attendData },
      { data: evalData },
    ] = await Promise.all([
      supabase.from('lessons').select('*, lesson_types(*)').eq('id', lessonId).single(),
      supabase.from('curriculum_items').select('*').order('level').order('display_order'),
      supabase.from('lesson_plan_items').select('*, curriculum_items(*)').eq('lesson_id', lessonId),
      supabase.from('attendance').select('student_id, students(*)').eq('lesson_id', lessonId).in('status', ['present', 'late']),
      supabase.from('lesson_evaluations').select('*').eq('lesson_id', lessonId),
    ])

    setLesson(lessonData as any)

    // Build tree
    const flat: CurriculumItem[] = currData ?? []
    const roots = flat.filter(i => !i.parent_id)
    for (const root of roots) {
      root.children = flat.filter(i => i.parent_id === root.id)
      for (const child of root.children) {
        child.children = flat.filter(i => i.parent_id === child.id)
      }
    }
    setCurriculumTree(roots)
    setPlanItems((planData ?? []) as LessonPlanItem[])
    setAttendingStudents((attendData ?? []) as any)

    // Build evalMap
    const map: EvalMap = {}
    for (const e of evalData ?? []) {
      const ev = e as LessonEvaluation
      if (!map[ev.student_id]) map[ev.student_id] = {}
      map[ev.student_id][ev.curriculum_item_id] = { rating: ev.rating ?? 0, notes: ev.notes ?? '' }
    }
    setEvalMap(map)
    setLoading(false)
  }

  const planItemIds = new Set(planItems.map(p => p.curriculum_item_id))

  async function togglePlanItem(item: CurriculumItem) {
    if (planItemIds.has(item.id)) {
      await supabase.from('lesson_plan_items').delete().eq('lesson_id', lessonId).eq('curriculum_item_id', item.id)
    } else {
      await supabase.from('lesson_plan_items').insert({ lesson_id: lessonId, curriculum_item_id: item.id, display_order: planItems.length })
    }
    const { data } = await supabase.from('lesson_plan_items').select('*, curriculum_items(*)').eq('lesson_id', lessonId)
    setPlanItems((data ?? []) as LessonPlanItem[])
  }

  async function updatePlanNotes(planItemId: string, notes: string) {
    await supabase.from('lesson_plan_items').update({ plan_notes: notes }).eq('id', planItemId)
    setPlanItems(prev => prev.map(p => p.id === planItemId ? { ...p, plan_notes: notes } : p))
  }

  function setEval(studentId: string, itemId: string, field: 'rating' | 'notes', value: string | number) {
    setEvalMap(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] ?? {}),
        [itemId]: {
          rating: (prev[studentId]?.[itemId]?.rating ?? 0),
          notes: (prev[studentId]?.[itemId]?.notes ?? ''),
          [field]: value,
        },
      },
    }))
  }

  async function saveEvaluations() {
    setSaving(true)
    const rows = []
    for (const [studentId, items] of Object.entries(evalMap)) {
      for (const [itemId, val] of Object.entries(items)) {
        rows.push({
          lesson_id: lessonId,
          student_id: studentId,
          curriculum_item_id: itemId,
          rating: val.rating || null,
          notes: val.notes || null,
          updated_at: new Date().toISOString(),
        })
      }
    }
    if (rows.length > 0) {
      await supabase.from('lesson_evaluations').upsert(rows, { onConflict: 'lesson_id,student_id,curriculum_item_id' })
    }

    // カルテに自動書き込み
    if (lesson) {
      const lessonDate = new Date(lesson.scheduled_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
      for (const att of attendingStudents) {
        const studentId = att.student_id
        const studentEvals = evalMap[studentId]
        if (!studentEvals) continue

        const lines: string[] = [`【レッスン評価: ${lessonDate} ${lesson.title}】`]
        for (const planItem of planItems) {
          const item = planItem.curriculum_items as CurriculumItem | null
          if (!item) continue
          const val = studentEvals[item.id]
          if (!val?.notes) continue
          const parentName = item.parent_id
            ? curriculumTree.flatMap(r => r.children ?? []).find(c => c.id === item.parent_id)?.name ?? ''
            : ''
          const label = parentName ? `${parentName} > ${item.name}` : item.name
          lines.push(`● ${label}: ${val.notes}`)
        }

        if (lines.length > 1) {
          await supabase.from('student_records').insert({
            student_id: studentId,
            record_date: new Date(lesson.scheduled_at).toISOString().slice(0, 10),
            content: lines.join('\n'),
          })
        }
      }
    }

    setSaving(false)
    setSavedEval(true)
    setTimeout(() => setSavedEval(false), 3000)
  }

  async function addCurriculumItem() {
    if (!newItemName.trim() || !newItemParent) return
    await supabase.from('curriculum_items').insert({
      parent_id: newItemParent.parentId,
      name: newItemName.trim(),
      level: newItemParent.level,
      display_order: 99,
    })
    setNewItemName('')
    setNewItemParent(null)
    loadAll()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <Loader2 size={24} className="animate-spin mr-2" /> 読み込み中...
      </div>
    )
  }

  if (!lesson) return <div className="text-gray-500 p-8">レッスンが見つかりません</div>

  const dt = new Date(lesson.scheduled_at)
  const lessonLabel = `${dt.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}（${WEEKDAYS[dt.getDay()]}）${dt.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} ${lesson.title}`

  return (
    <div>
      {/* ヘッダー */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/lessons" className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-800">{lessonLabel}</h1>
          {lesson.location && <p className="text-sm text-gray-500 mt-0.5">{lesson.location}</p>}
        </div>
      </div>

      {/* タブ */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
        <button
          onClick={() => setTab('plan')}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'plan' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <BookOpen size={15} /> 計画
        </button>
        <button
          onClick={() => setTab('evaluation')}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'evaluation' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <ClipboardList size={15} /> 評価
          {planItems.length > 0 && attendingStudents.length > 0 && (
            <span className="bg-indigo-100 text-indigo-600 text-xs px-1.5 py-0.5 rounded-full">{attendingStudents.length}名</span>
          )}
        </button>
      </div>

      {/* 計画タブ */}
      {tab === 'plan' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">このレッスンで扱う項目を選択し、内容メモを記入してください。</p>
          {curriculumTree.map(root => (
            <div key={root.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
              {/* 大項目ヘッダー */}
              <button
                onClick={() => setExpandedItems(prev => {
                  const next = new Set(prev)
                  next.has(root.id) ? next.delete(root.id) : next.add(root.id)
                  return next
                })}
                className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-gray-50 transition-colors"
              >
                <span className="font-semibold text-gray-800">{root.name}</span>
                {expandedItems.has(root.id) ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
              </button>

              {expandedItems.has(root.id) && (
                <div className="border-t border-gray-100">
                  {(root.children ?? []).map(mid => (
                    <div key={mid.id}>
                      {/* 中項目 */}
                      <div className="flex items-start gap-3 px-5 py-3 border-b border-gray-50 bg-gray-50/50">
                        <button
                          onClick={() => togglePlanItem(mid)}
                          className={`mt-0.5 w-5 h-5 rounded flex-shrink-0 border-2 transition-colors flex items-center justify-center ${planItemIds.has(mid.id) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 hover:border-indigo-400'}`}
                        >
                          {planItemIds.has(mid.id) && <span className="text-white text-xs font-bold">✓</span>}
                        </button>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-gray-700">{mid.name}</span>
                          {planItemIds.has(mid.id) && (
                            <textarea
                              value={planItems.find(p => p.curriculum_item_id === mid.id)?.plan_notes ?? ''}
                              onChange={e => {
                                const pi = planItems.find(p => p.curriculum_item_id === mid.id)
                                if (pi) updatePlanNotes(pi.id, e.target.value)
                              }}
                              placeholder="計画メモ（内容・目標など）"
                              rows={2}
                              className="mt-2 w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                            />
                          )}
                        </div>
                      </div>
                      {/* 小項目 */}
                      {(mid.children ?? []).map(small => (
                        <div key={small.id} className="flex items-start gap-3 pl-12 pr-5 py-2.5 border-b border-gray-50">
                          <button
                            onClick={() => togglePlanItem(small)}
                            className={`mt-0.5 w-4 h-4 rounded flex-shrink-0 border-2 transition-colors flex items-center justify-center ${planItemIds.has(small.id) ? 'bg-indigo-500 border-indigo-500' : 'border-gray-300 hover:border-indigo-400'}`}
                          >
                            {planItemIds.has(small.id) && <span className="text-white text-[10px] font-bold">✓</span>}
                          </button>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-gray-600">{small.name}</span>
                            {planItemIds.has(small.id) && (
                              <textarea
                                value={planItems.find(p => p.curriculum_item_id === small.id)?.plan_notes ?? ''}
                                onChange={e => {
                                  const pi = planItems.find(p => p.curriculum_item_id === small.id)
                                  if (pi) updatePlanNotes(pi.id, e.target.value)
                                }}
                                placeholder="計画メモ"
                                rows={2}
                                className="mt-2 w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                              />
                            )}
                          </div>
                        </div>
                      ))}
                      {/* 小項目追加 */}
                      {newItemParent?.parentId === mid.id ? (
                        <div className="flex items-center gap-2 pl-12 pr-5 py-2.5 border-b border-gray-50">
                          <input
                            value={newItemName}
                            onChange={e => setNewItemName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addCurriculumItem()}
                            placeholder="新しい小項目名"
                            className="flex-1 border border-indigo-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            autoFocus
                          />
                          <button onClick={addCurriculumItem} className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700">追加</button>
                          <button onClick={() => setNewItemParent(null)} className="text-xs text-gray-400 hover:text-gray-600">キャンセル</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setNewItemParent({ parentId: mid.id, level: 3 }); setNewItemName('') }}
                          className="flex items-center gap-1 pl-12 pr-5 py-2 text-xs text-gray-400 hover:text-indigo-600 transition-colors"
                        >
                          <Plus size={12} /> 小項目を追加
                        </button>
                      )}
                    </div>
                  ))}
                  {/* 中項目追加 */}
                  {newItemParent?.parentId === root.id ? (
                    <div className="flex items-center gap-2 px-5 py-3">
                      <input
                        value={newItemName}
                        onChange={e => setNewItemName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addCurriculumItem()}
                        placeholder="新しい中項目名"
                        className="flex-1 border border-indigo-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        autoFocus
                      />
                      <button onClick={addCurriculumItem} className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700">追加</button>
                      <button onClick={() => setNewItemParent(null)} className="text-sm text-gray-400 hover:text-gray-600">キャンセル</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setNewItemParent({ parentId: root.id, level: 2 }); setNewItemName('') }}
                      className="flex items-center gap-1 px-5 py-3 text-xs text-gray-400 hover:text-indigo-600 transition-colors w-full"
                    >
                      <Plus size={12} /> 中項目を追加
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}

          {planItems.length > 0 && (
            <div className="bg-indigo-50 rounded-xl px-5 py-3 text-sm text-indigo-700">
              {planItems.length}項目を計画中 — 「評価」タブで各生徒を評価できます
            </div>
          )}
        </div>
      )}

      {/* 評価タブ */}
      {tab === 'evaluation' && (
        <div>
          {planItems.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-400">
              <BookOpen size={32} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm">まず「計画」タブで項目を選択してください</p>
            </div>
          ) : attendingStudents.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-400">
              <ClipboardList size={32} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm">出席記録がありません</p>
              <p className="text-xs mt-1">出席管理ページで出席を記録してから評価してください</p>
            </div>
          ) : (
            <div className="space-y-6">
              {attendingStudents.map(att => {
                const student = att.students
                if (!student) return null
                return (
                  <div key={att.student_id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <div className="px-5 py-3.5 bg-gray-50 border-b border-gray-100">
                      <span className="font-semibold text-gray-800">{student.name}</span>
                      {student.name_kana && <span className="text-xs text-gray-400 ml-2">{student.name_kana}</span>}
                    </div>
                    <div className="divide-y divide-gray-50">
                      {planItems.map(pi => {
                        const item = pi.curriculum_items as CurriculumItem | null
                        if (!item) return null
                        const val = evalMap[att.student_id]?.[item.id]
                        const parent = item.parent_id
                          ? curriculumTree.flatMap(r => [...(r.children ?? []), ...(r.children?.flatMap(c => c.children ?? []) ?? [])]).find(c => c.id === item.parent_id)
                          : null
                        return (
                          <div key={pi.id} className="px-5 py-4">
                            <div className="flex items-start gap-4">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-gray-400">{parent?.name ?? item.name}</p>
                                {parent && <p className="text-sm font-medium text-gray-700">{item.name}</p>}
                                {pi.plan_notes && <p className="text-xs text-gray-400 mt-0.5 italic">計画: {pi.plan_notes}</p>}
                              </div>
                              {/* 5段階評価（先生のみ） */}
                              <div className="flex gap-1 flex-shrink-0">
                                {[1, 2, 3, 4, 5].map(s => (
                                  <button
                                    key={s}
                                    onClick={() => setEval(att.student_id, item.id, 'rating', s === (val?.rating ?? 0) ? 0 : s)}
                                    className={`transition-colors ${s <= (val?.rating ?? 0) ? 'text-yellow-400' : 'text-gray-200 hover:text-yellow-300'}`}
                                  >
                                    <Star size={20} fill={s <= (val?.rating ?? 0) ? 'currentColor' : 'none'} />
                                  </button>
                                ))}
                              </div>
                            </div>
                            {/* 共有メモ（生徒も閲覧） */}
                            <textarea
                              value={val?.notes ?? ''}
                              onChange={e => setEval(att.student_id, item.id, 'notes', e.target.value)}
                              placeholder="メモ（生徒と共有されます）"
                              rows={2}
                              className="mt-2 w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                            />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              <div className="flex justify-end">
                <button
                  onClick={saveEvaluations}
                  disabled={saving}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-6 py-2.5 rounded-xl text-sm font-medium shadow-sm transition-colors"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : savedEval ? <CheckCircle size={16} /> : <Save size={16} />}
                  {saving ? '保存中...' : savedEval ? '保存しカルテに記録しました' : '評価を保存・カルテに書き込む'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
