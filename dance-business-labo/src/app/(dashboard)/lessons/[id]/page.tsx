'use client'

import { useEffect, useState, use, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Lesson, LessonType, CurriculumItem, LessonPlanItem, LessonEvaluation, Student } from '@/types/database'
import { ArrowLeft, Plus, Trash2, Star, ChevronDown, ChevronRight, Save, CheckCircle, Loader2, BookOpen, ClipboardList, MessageSquare, Send, X } from 'lucide-react'
import Link from 'next/link'

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

function parseJST(s: string): Date {
  const clean = s.slice(0, 16).replace(' ', 'T')
  const [y, m, d] = clean.slice(0, 10).split('-').map(Number)
  const [h, min] = clean.slice(11).split(':').map(Number)
  return new Date(y, m - 1, d, h, min)
}

type AttendingStudent = { student_id: string; students: Student | null }
type EvalMap = Record<string, Record<string, { rating: number; notes: string }>>

export default function LessonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: lessonId } = use(params)
  const supabase = createClient()

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
  // 計画パネルの開閉（モバイル用）
  const [planOpen, setPlanOpen] = useState(true)
  // 計画編集モード（全ツリー表示）
  const [planEditMode, setPlanEditMode] = useState(false)
  const composingRef = useRef(false)
  // 計画メモ・評価メモの編集中ID
  const [editingPlanNote, setEditingPlanNote] = useState<string | null>(null)
  const [editingEvalNote, setEditingEvalNote] = useState<string | null>(null) // `${studentId}:${itemId}`
  // 実施メモ（実際に行った内容）の編集中ID・計画外項目の追加
  const [editingActualNote, setEditingActualNote] = useState<string | null>(null) // planItemId
  const [addingActualParent, setAddingActualParent] = useState<{ parentId: string; level: number } | null>(null)
  const [newActualItemName, setNewActualItemName] = useState('')
  // AIチャット
  const [chatOpen, setChatOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [copyingFromPrevious, setCopyingFromPrevious] = useState(false)

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

    const flat: CurriculumItem[] = currData ?? []
    const roots = flat.filter(i => !i.parent_id)
    for (const root of roots) {
      root.children = flat.filter(i => i.parent_id === root.id)
      for (const child of root.children) {
        child.children = flat.filter(i => i.parent_id === child.id)
      }
    }
    setCurriculumTree(roots)

    let resolvedPlanItems = (planData ?? []) as LessonPlanItem[]

    if (resolvedPlanItems.length === 0 && lessonData) {
      const { data: prevLesson } = await supabase
        .from('lessons').select('id').eq('title', (lessonData as any).title)
        .lt('scheduled_at', (lessonData as any).scheduled_at)
        .order('scheduled_at', { ascending: false }).limit(1).single()

      if (prevLesson) {
        const { data: prevPlan } = await supabase
          .from('lesson_plan_items').select('curriculum_item_id, plan_notes, display_order').eq('lesson_id', prevLesson.id)
        if (prevPlan && prevPlan.length > 0) {
          const rows = prevPlan.map((p, i) => ({
            lesson_id: lessonId, curriculum_item_id: p.curriculum_item_id,
            plan_notes: p.plan_notes, display_order: p.display_order ?? i,
          }))
          await supabase.from('lesson_plan_items').insert(rows)
          const { data: newPlan } = await supabase.from('lesson_plan_items').select('*, curriculum_items(*)').eq('lesson_id', lessonId)
          resolvedPlanItems = (newPlan ?? []) as LessonPlanItem[]
        }
      }
    }

    setPlanItems(resolvedPlanItems)
    setAttendingStudents((attendData ?? []) as any)

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
      const inserts: { lesson_id: string; curriculum_item_id: string; display_order: number }[] = [
        { lesson_id: lessonId, curriculum_item_id: item.id, display_order: planItems.length },
      ]
      if (item.level === 3 && item.parent_id && !planItemIds.has(item.parent_id)) {
        inserts.unshift({ lesson_id: lessonId, curriculum_item_id: item.parent_id, display_order: planItems.length - 1 })
      }
      await supabase.from('lesson_plan_items').insert(inserts)
    }
    const { data } = await supabase.from('lesson_plan_items').select('*, curriculum_items(*)').eq('lesson_id', lessonId)
    setPlanItems((data ?? []) as LessonPlanItem[])
  }

  async function updatePlanNotes(planItemId: string, notes: string) {
    await supabase.from('lesson_plan_items').update({ plan_notes: notes }).eq('id', planItemId)
    setPlanItems(prev => prev.map(p => p.id === planItemId ? { ...p, plan_notes: notes } : p))
  }

  // 実際に行った内容を記録し、カリキュラムの指導ノートにも反映（最新の内容で上書き）
  async function updateActualNotes(planItem: LessonPlanItem, notes: string) {
    await supabase.from('lesson_plan_items').update({ actual_notes: notes }).eq('id', planItem.id)
    setPlanItems(prev => prev.map(p => p.id === planItem.id ? { ...p, actual_notes: notes } : p))
    if (notes.trim()) {
      await supabase.from('curriculum_items').update({ teaching_notes: notes }).eq('id', planItem.curriculum_item_id)
      setCurriculumTree(prev => prev.map(root => ({
        ...root,
        children: (root.children ?? []).map(mid => ({
          ...mid,
          ...(mid.id === planItem.curriculum_item_id ? { teaching_notes: notes } : {}),
          children: (mid.children ?? []).map(small =>
            small.id === planItem.curriculum_item_id ? { ...small, teaching_notes: notes } : small
          ),
        })),
        ...(root.id === planItem.curriculum_item_id ? { teaching_notes: notes } : {}),
      })))
    }
  }

  // 計画になかった項目を「実施した項目」としてカリキュラムに追加し、当該レッスンの計画にも紐づける
  async function addActualItem() {
    if (!newActualItemName.trim() || !addingActualParent) return
    const { data: newItem } = await supabase.from('curriculum_items').insert({
      parent_id: addingActualParent.parentId, name: newActualItemName.trim(),
      level: addingActualParent.level, display_order: 99,
    }).select().single()
    if (newItem) {
      await supabase.from('lesson_plan_items').insert({
        lesson_id: lessonId, curriculum_item_id: newItem.id, display_order: planItems.length,
      })
    }
    setNewActualItemName('')
    setAddingActualParent(null)
    loadAll()
  }

  function setEval(studentId: string, itemId: string, field: 'rating' | 'notes', value: string | number) {
    setEvalMap(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] ?? {}),
        [itemId]: {
          rating: prev[studentId]?.[itemId]?.rating ?? 0,
          notes: prev[studentId]?.[itemId]?.notes ?? '',
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
          lesson_id: lessonId, student_id: studentId, curriculum_item_id: itemId,
          rating: val.rating || null, notes: val.notes || null,
          updated_at: new Date().toISOString(),
        })
      }
    }
    if (rows.length > 0) {
      await supabase.from('lesson_evaluations').upsert(rows, { onConflict: 'lesson_id,student_id,curriculum_item_id' })
    }

    if (lesson) {
      const lessonDate = parseJST(lesson.scheduled_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
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
            student_id: studentId, record_date: lesson.scheduled_at.slice(0, 10), content: lines.join('\n'),
          })
        }
      }

      // 生徒への評価コメントを指導ノートにも反映（実施メモが未入力の項目のみ。既存の実施メモは上書きしない）
      for (const planItem of planItems) {
        if (planItem.actual_notes && planItem.actual_notes.trim()) continue
        const itemId = planItem.curriculum_item_id
        const notesForItem = attendingStudents
          .map(att => evalMap[att.student_id]?.[itemId]?.notes)
          .filter((n): n is string => !!n && n.trim().length > 0)
        if (notesForItem.length === 0) continue
        const combined = [...new Set(notesForItem)].join(' / ')
        await supabase.from('lesson_plan_items').update({ actual_notes: combined }).eq('id', planItem.id)
        await supabase.from('curriculum_items').update({ teaching_notes: combined }).eq('id', itemId)
      }
    }

    await loadAll()
    setSaving(false)
    setSavedEval(true)
    setTimeout(() => setSavedEval(false), 3000)
  }

  async function sendChat() {
    if (!chatInput.trim() || chatLoading || !lesson) return
    const userMsg = { role: 'user' as const, content: chatInput.trim() }
    const newMessages = [...chatMessages, userMsg]
    setChatMessages(newMessages)
    setChatInput('')
    setChatLoading(true)

    const dt = parseJST(lesson.scheduled_at)
    const planSummary = curriculumTree.map(root => {
      const mids = (root.children ?? []).filter(mid =>
        planItemIds.has(mid.id) || (mid.children ?? []).some(s => planItemIds.has(s.id))
      )
      if (!mids.length) return null
      return `【${root.name}】\n` + mids.map(mid => {
        const smalls = (mid.children ?? []).filter(s => planItemIds.has(s.id))
        return `  ${mid.name}` + (smalls.length ? '\n' + smalls.map(s => `    ・${s.name}`).join('\n') : '')
      }).join('\n')
    }).filter(Boolean).join('\n\n')

    const lessonContext = `日時: ${dt.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })} ${dt.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
レッスン名: ${lesson.title}
出席予定生徒数: ${attendingStudents.length}名

## 現在の計画項目
${planSummary || '（未設定）'}`

    try {
      const res = await fetch('/api/lessons/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, lessonContext }),
      })
      if (!res.ok || !res.body) throw new Error('API error')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let assistantText = ''
      setChatMessages(prev => [...prev, { role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        assistantText += decoder.decode(value, { stream: true })
        setChatMessages(prev => {
          const msgs = [...prev]
          msgs[msgs.length - 1] = { role: 'assistant', content: assistantText }
          return msgs
        })
      }
    } catch {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'エラーが発生しました。ANTHROPIC_API_KEYが設定されているか確認してください。' }])
    }
    setChatLoading(false)
  }

  async function addCurriculumItem() {
    if (!newItemName.trim() || !newItemParent) return
    await supabase.from('curriculum_items').insert({
      parent_id: newItemParent.parentId, name: newItemName.trim(),
      level: newItemParent.level, display_order: 99,
    })
    setNewItemName('')
    setNewItemParent(null)
    loadAll()
  }

  async function copyFromPreviousWeek() {
    if (!lesson) return
    setCopyingFromPrevious(true)
    try {
      const res = await fetch(`/api/lessons/${lesson.id}/copy-curriculum`, {
        method: 'POST',
      })
      if (!res.ok) {
        const error = await res.json()
        alert(`エラー: ${error.error}`)
        return
      }
      const data = await res.json()
      alert(`✅ ${data.copied_from} からカリキュラムをコピーしました（${data.items_count}項目）`)
      loadAll()
    } catch (error) {
      alert(`エラー: ${error instanceof Error ? error.message : '不明なエラー'}`)
    } finally {
      setCopyingFromPrevious(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20 text-gray-400">
      <Loader2 size={24} className="animate-spin mr-2" /> 読み込み中...
    </div>
  )

  if (!lesson) return <div className="text-gray-500 p-8">レッスンが見つかりません</div>

  const dt = parseJST(lesson.scheduled_at)
  const lessonLabel = `${dt.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}（${WEEKDAYS[dt.getDay()]}）${dt.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} ${lesson.title}`

  const hasStudents = attendingStudents.length > 0
  const hasPlan = planItems.length > 0

  return (
    <div>
      {/* ヘッダー */}
      <div className="flex items-center gap-3 mb-5">
        <Link href="/lessons" className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-800">{lessonLabel}</h1>
          {lesson.location && <p className="text-sm text-gray-500 mt-0.5">{lesson.location}</p>}
        </div>
      </div>

      {/* 2カラムレイアウト（lg以上）/ スタックレイアウト（モバイル） */}
      <div className="flex flex-col lg:flex-row gap-4 items-start">

        {/* ======= 左：計画パネル ======= */}
        <div className="w-full lg:w-80 xl:w-96 flex-shrink-0 lg:sticky lg:top-4">
          <div className="bg-white rounded-xl shadow-sm overflow-hidden flex flex-col max-h-[calc(100vh-6rem)]">
            {/* 計画ヘッダー（モバイルでは折りたたみ可） */}
            <button
              className="w-full flex items-center justify-between px-4 py-3 bg-indigo-50 border-b border-indigo-100"
              onClick={() => setPlanOpen(v => !v)}>
              <div className="flex items-center gap-2">
                <BookOpen size={15} className="text-indigo-600" />
                <span className="font-semibold text-indigo-800 text-sm">計画</span>
                {hasPlan && <span className="text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full">{planItems.length}項目</span>}
              </div>
              {planOpen ? <ChevronDown size={15} className="text-indigo-400" /> : <ChevronRight size={15} className="text-indigo-400" />}
            </button>

            {planOpen && (
              <div className="overflow-y-auto flex-1">
                {/* ===== 通常表示：計画済み項目のみ ===== */}
                {!planEditMode && (
                  <>
                    {!hasPlan ? (
                      <div className="px-4 py-6 text-center text-gray-400 text-xs">
                        <p>計画項目がありません</p>
                        <button onClick={() => setPlanEditMode(true)} className="mt-2 text-indigo-500 hover:text-indigo-700 underline">項目を追加する</button>
                        <button 
                          onClick={copyFromPreviousWeek}
                          disabled={copyingFromPrevious}
                          className="mt-2 block mx-auto text-amber-600 hover:text-amber-700 disabled:text-gray-300 underline"
                        >
                          {copyingFromPrevious ? 'コピー中...' : '前週のカリキュラムをコピー'}
                        </button>
                      </div>
                    ) : (
                      <div>
                        {curriculumTree.map(root => {
                          // この大項目に計画済み項目があるか確認
                          const allChildren = [
                            ...(root.children ?? []),
                            ...(root.children ?? []).flatMap(c => c.children ?? []),
                          ]
                          const rootHasPlan = planItemIds.has(root.id) || allChildren.some(c => planItemIds.has(c.id))
                          if (!rootHasPlan) return null
                          return (
                            <div key={root.id} className="border-b border-gray-100 last:border-0">
                              {/* 大項目ラベル */}
                              <div className="px-4 py-2 bg-indigo-50/60">
                                <span className="text-xs font-bold text-indigo-700">{root.name}</span>
                              </div>
                              {/* 計画済みの中項目・小項目 */}
                              {(root.children ?? []).map(mid => {
                                const midChildren = mid.children ?? []
                                const midHasPlan = planItemIds.has(mid.id) || midChildren.some(c => planItemIds.has(c.id))
                                if (!midHasPlan) return null
                                const midPlanItem = planItems.find(p => p.curriculum_item_id === mid.id)
                                return (
                                  <div key={mid.id}>
                                    {planItemIds.has(mid.id) && (
                                      <div className="px-4 py-2 bg-gray-50/50 border-b border-gray-50">
                                        <span className="text-xs font-medium text-gray-700">{mid.name}</span>
                                      </div>
                                    )}
                                    {midChildren.filter(s => planItemIds.has(s.id)).map(small => {
                                      const smallPlanItem = planItems.find(p => p.curriculum_item_id === small.id)
                                      return (
                                        <div key={small.id} className="pl-8 pr-4 py-2 border-b border-gray-50">
                                          <div className="flex items-center gap-1 flex-1 min-w-0">
                                            <span className="text-xs text-gray-600">{small.name}</span>
                                            {smallPlanItem && editingPlanNote !== smallPlanItem.id && (
                                              <button onClick={() => setEditingPlanNote(smallPlanItem.id)}
                                                className="ml-1 text-gray-300 hover:text-indigo-400 flex-shrink-0">
                                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                              </button>
                                            )}
                                          </div>
                                          {smallPlanItem && smallPlanItem.plan_notes && editingPlanNote !== smallPlanItem.id && (
                                            <p className="text-xs text-indigo-500 mt-0.5 cursor-pointer" onClick={() => setEditingPlanNote(smallPlanItem.id)}>{smallPlanItem.plan_notes}</p>
                                          )}
                                          {smallPlanItem && editingPlanNote === smallPlanItem.id && (
                                            <textarea
                                              defaultValue={smallPlanItem.plan_notes ?? ''}
                                              onCompositionStart={() => { composingRef.current = true }}
                                              onCompositionEnd={e => { composingRef.current = false; updatePlanNotes(smallPlanItem.id, (e.target as HTMLTextAreaElement).value) }}
                                              onChange={e => { if (!composingRef.current) updatePlanNotes(smallPlanItem.id, e.target.value) }}
                                              onBlur={() => setEditingPlanNote(null)}
                                              placeholder="計画メモ"
                                              rows={2}
                                              autoFocus
                                              className="mt-1.5 w-full border border-indigo-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                                          )}
                                          {/* 実施メモ（実際に行った内容。カリキュラムの指導ノートにも反映） */}
                                          {smallPlanItem && editingActualNote !== smallPlanItem.id && (
                                            <button onClick={() => setEditingActualNote(smallPlanItem.id)}
                                              className="mt-1 block text-left text-[11px] text-amber-600 hover:text-amber-700">
                                              {smallPlanItem.actual_notes ? `実施: ${smallPlanItem.actual_notes}` : '+ 実施メモを記録'}
                                            </button>
                                          )}
                                          {smallPlanItem && editingActualNote === smallPlanItem.id && (
                                            <textarea
                                              defaultValue={smallPlanItem.actual_notes ?? ''}
                                              onCompositionStart={() => { composingRef.current = true }}
                                              onCompositionEnd={e => { composingRef.current = false; updateActualNotes(smallPlanItem, (e.target as HTMLTextAreaElement).value) }}
                                              onChange={e => { if (!composingRef.current) updateActualNotes(smallPlanItem, e.target.value) }}
                                              onBlur={() => setEditingActualNote(null)}
                                              placeholder="実際に行った内容（カリキュラムにも反映されます）"
                                              rows={2}
                                              autoFocus
                                              className="mt-1.5 w-full border border-amber-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none" />
                                          )}
                                        </div>
                                      )
                                    })}
                                    {/* 計画になかった項目を実施として追加 */}
                                    {addingActualParent?.parentId === mid.id ? (
                                      <div className="flex items-center gap-2 pl-9 pr-4 py-2 border-b border-gray-50 bg-amber-50/40">
                                        <input value={newActualItemName} onChange={e => setNewActualItemName(e.target.value)}
                                          onKeyDown={e => e.key === 'Enter' && addActualItem()} placeholder="実際に行った項目名" autoFocus
                                          className="flex-1 border border-amber-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500" />
                                        <button onClick={addActualItem} className="text-xs bg-amber-600 text-white px-2 py-1 rounded-lg">追加</button>
                                        <button onClick={() => setAddingActualParent(null)} className="text-xs text-gray-400">×</button>
                                      </div>
                                    ) : (
                                      <button onClick={() => { setAddingActualParent({ parentId: mid.id, level: 3 }); setNewActualItemName('') }}
                                        className="flex items-center gap-1 pl-9 pr-4 py-1.5 text-[11px] text-amber-500 hover:text-amber-700 transition-colors w-full">
                                        <Plus size={10} /> 計画外の項目を実施として追加
                                      </button>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )
                        })}
                        <button onClick={() => setPlanEditMode(true)}
                          className="flex items-center gap-1 w-full px-4 py-2.5 text-xs text-gray-400 hover:text-indigo-500 transition-colors border-t border-gray-100">
                          <Plus size={11} /> 項目を追加・変更する
                        </button>
                      </div>
                    )}
                  </>
                )}

                {/* ===== 編集モード：全ツリー表示 ===== */}
                {planEditMode && (
                  <div>
                    <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
                      <span className="text-xs text-amber-700 font-medium">チェックで追加・解除</span>
                      <button onClick={() => setPlanEditMode(false)}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">完了</button>
                    </div>
                    {curriculumTree.map(root => (
                      <div key={root.id}>
                        <button
                          onClick={() => setExpandedItems(prev => {
                            const next = new Set(prev); next.has(root.id) ? next.delete(root.id) : next.add(root.id); return next
                          })}
                          className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-gray-50 transition-colors border-b border-gray-100">
                          <span className="font-semibold text-gray-800 text-sm">{root.name}</span>
                          {expandedItems.has(root.id) ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                        </button>
                        {expandedItems.has(root.id) && (
                          <div className="border-b border-gray-100">
                            {(root.children ?? []).map(mid => (
                              <div key={mid.id}>
                                <div className="flex items-center gap-2 px-4 py-2 bg-gray-50/60 border-b border-gray-50">
                                  <button onClick={() => togglePlanItem(mid)}
                                    className={`w-4 h-4 rounded flex-shrink-0 border-2 transition-colors flex items-center justify-center ${planItemIds.has(mid.id) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 hover:border-indigo-400'}`}>
                                    {planItemIds.has(mid.id) && <span className="text-white text-[10px] font-bold">✓</span>}
                                  </button>
                                  <span className="text-xs font-medium text-gray-700">{mid.name}</span>
                                </div>
                                {(mid.children ?? []).map(small => (
                                  <div key={small.id} className="flex items-center gap-2 pl-9 pr-4 py-2 border-b border-gray-50">
                                    <button onClick={() => togglePlanItem(small)}
                                      className={`w-3.5 h-3.5 rounded flex-shrink-0 border-2 transition-colors flex items-center justify-center ${planItemIds.has(small.id) ? 'bg-indigo-500 border-indigo-500' : 'border-gray-300 hover:border-indigo-400'}`}>
                                      {planItemIds.has(small.id) && <span className="text-white text-[8px] font-bold">✓</span>}
                                    </button>
                                    <span className="text-xs text-gray-600">{small.name}</span>
                                  </div>
                                ))}
                                {newItemParent?.parentId === mid.id ? (
                                  <div className="flex items-center gap-2 pl-9 pr-4 py-2 border-b border-gray-50 bg-indigo-50/40">
                                    <input value={newItemName} onChange={e => setNewItemName(e.target.value)}
                                      onKeyDown={e => e.key === 'Enter' && addCurriculumItem()} placeholder="新しい小項目名" autoFocus
                                      className="flex-1 border border-indigo-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                    <button onClick={addCurriculumItem} className="text-xs bg-indigo-600 text-white px-2 py-1 rounded-lg">追加</button>
                                    <button onClick={() => setNewItemParent(null)} className="text-xs text-gray-400">×</button>
                                  </div>
                                ) : (
                                  <button onClick={() => { setNewItemParent({ parentId: mid.id, level: 3 }); setNewItemName('') }}
                                    className="flex items-center gap-1 pl-9 pr-4 py-1.5 text-xs text-gray-300 hover:text-indigo-500 transition-colors w-full">
                                    <Plus size={10} /> 小項目を追加
                                  </button>
                                )}
                              </div>
                            ))}
                            {newItemParent?.parentId === root.id ? (
                              <div className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50/40">
                                <input value={newItemName} onChange={e => setNewItemName(e.target.value)}
                                  onKeyDown={e => e.key === 'Enter' && addCurriculumItem()} placeholder="新しい中項目名" autoFocus
                                  className="flex-1 border border-indigo-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                <button onClick={addCurriculumItem} className="text-xs bg-indigo-600 text-white px-2 py-1 rounded-lg">追加</button>
                                <button onClick={() => setNewItemParent(null)} className="text-xs text-gray-400">×</button>
                              </div>
                            ) : (
                              <button onClick={() => { setNewItemParent({ parentId: root.id, level: 2 }); setNewItemName('') }}
                                className="flex items-center gap-1 px-4 py-2.5 text-xs text-gray-300 hover:text-indigo-500 transition-colors w-full">
                                <Plus size={11} /> 中項目を追加
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ======= 右：評価パネル ======= */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-3 px-1">
            <ClipboardList size={15} className="text-gray-500" />
            <span className="font-semibold text-gray-700 text-sm">評価</span>
            {hasStudents && <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{attendingStudents.length}名</span>}
          </div>

          {!hasPlan ? (
            <div className="bg-white rounded-xl shadow-sm p-10 text-center text-gray-400">
              <BookOpen size={28} className="mx-auto mb-2 opacity-20" />
              <p className="text-sm">左の計画パネルで項目を選択してください</p>
            </div>
          ) : !hasStudents ? (
            <div className="bg-white rounded-xl shadow-sm p-10 text-center text-gray-400">
              <ClipboardList size={28} className="mx-auto mb-2 opacity-20" />
              <p className="text-sm">出席記録がありません</p>
              <p className="text-xs mt-1">出席管理ページで出席を記録してから評価してください</p>
            </div>
          ) : (
            <div className="space-y-4">
              {attendingStudents.map(att => {
                const student = att.students
                if (!student) return null
                return (
                  <div key={att.student_id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                      <span className="font-semibold text-gray-800 text-sm">{student.name}</span>
                      {student.name_kana && <span className="text-xs text-gray-400 ml-2">{student.name_kana}</span>}
                    </div>
                    <div>
                      {curriculumTree.map(root => {
                        const allDescendants = [
                          ...(root.children ?? []),
                          ...(root.children ?? []).flatMap(c => c.children ?? []),
                        ]
                        const rootHasPlan = planItemIds.has(root.id) || allDescendants.some(c => planItemIds.has(c.id))
                        if (!rootHasPlan) return null
                        return (
                          <div key={root.id} className="border-b border-gray-100 last:border-0">
                            <div className="px-4 py-2 bg-indigo-50/60">
                              <span className="text-xs font-bold text-indigo-700">{root.name}</span>
                            </div>
                            {(root.children ?? []).map(mid => {
                              const midChildren = mid.children ?? []
                              const midHasPlan = planItemIds.has(mid.id) || midChildren.some(c => planItemIds.has(c.id))
                              if (!midHasPlan) return null
                              const smallPlanned = midChildren.filter(s => planItemIds.has(s.id))
                              return (
                                <div key={mid.id}>
                                  <div className="px-4 py-2 bg-gray-50/50 border-t border-gray-100">
                                    <span className="text-xs font-medium text-gray-600">{mid.name}</span>
                                  </div>
                                  {smallPlanned.map(small => {
                                    const pi = planItems.find(p => p.curriculum_item_id === small.id)
                                    const val = evalMap[att.student_id]?.[small.id]
                                    return (
                                      <div key={small.id} className="px-4 py-3 border-t border-gray-50">
                                        <div className="flex items-center gap-3">
                                          <span className="flex-1 text-sm text-gray-700">{small.name}</span>
                                          <div className="flex items-center gap-1 flex-shrink-0">
                                            <button
                                              onClick={() => setEval(att.student_id, small.id, 'rating', (val?.rating ?? 0) > 0 ? 0 : 1)}
                                              className={`transition-colors ${(val?.rating ?? 0) > 0 ? 'text-yellow-400' : 'text-gray-200 hover:text-yellow-300'}`}
                                              title="特筆すべき点があればマーク">
                                              <Star size={18} fill={(val?.rating ?? 0) > 0 ? 'currentColor' : 'none'} />
                                            </button>
                                            {editingEvalNote !== `${att.student_id}:${small.id}` && (
                                              <button onClick={() => setEditingEvalNote(`${att.student_id}:${small.id}`)}
                                                className="ml-1 text-gray-300 hover:text-indigo-400">
                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                        {pi?.plan_notes && (
                                          <p className="text-xs text-indigo-400 mt-0.5">計画: {pi.plan_notes}</p>
                                        )}
                                        {val?.notes && editingEvalNote !== `${att.student_id}:${small.id}` && (
                                          <p className="text-xs text-gray-600 mt-1 cursor-pointer" onClick={() => setEditingEvalNote(`${att.student_id}:${small.id}`)}>{val.notes}</p>
                                        )}
                                        {editingEvalNote === `${att.student_id}:${small.id}` && (
                                          <textarea
                                            defaultValue={val?.notes ?? ''}
                                            onCompositionStart={() => { composingRef.current = true }}
                                            onCompositionEnd={e => { composingRef.current = false; setEval(att.student_id, small.id, 'notes', (e.target as HTMLTextAreaElement).value) }}
                                            onChange={e => { if (!composingRef.current) setEval(att.student_id, small.id, 'notes', e.target.value) }}
                                            onBlur={() => setEditingEvalNote(null)}
                                            placeholder="メモ（生徒と共有されます）"
                                            rows={2}
                                            autoFocus
                                            className="mt-1 w-full border border-indigo-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              )
                            })}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              <div className="flex justify-end pb-4">
                <button onClick={saveEvaluations} disabled={saving}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-6 py-2.5 rounded-xl text-sm font-medium shadow-sm transition-colors">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : savedEval ? <CheckCircle size={16} /> : <Save size={16} />}
                  {saving ? '保存中...' : savedEval ? '保存しカルテに記録しました' : '評価を保存・カルテに書き込む'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AIチャットボタン（フローティング） */}
      <button
        onClick={() => setChatOpen(v => !v)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-full shadow-lg transition-colors">
        <MessageSquare size={18} />
        <span className="text-sm font-medium">AIと相談</span>
      </button>

      {/* AIチャットパネル */}
      {chatOpen && (
        <div className="fixed bottom-20 right-6 z-50 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col" style={{ maxHeight: '70vh' }}>
          {/* ヘッダー */}
          <div className="flex items-center justify-between px-4 py-3 bg-indigo-600 rounded-t-2xl">
            <div className="flex items-center gap-2">
              <MessageSquare size={15} className="text-white" />
              <span className="text-sm font-semibold text-white">AI計画アシスタント</span>
            </div>
            <button onClick={() => setChatOpen(false)} className="text-indigo-200 hover:text-white">
              <X size={16} />
            </button>
          </div>

          {/* メッセージ一覧 */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
            {chatMessages.length === 0 && (
              <div className="text-center text-gray-400 text-xs py-6">
                <p className="mb-2">現在の計画について何でも相談してください</p>
                <div className="space-y-1">
                  {['この計画の進め方を教えて', '追加すると良い項目は？', '時間配分のアドバイスをして'].map(hint => (
                    <button key={hint} onClick={() => setChatInput(hint)}
                      className="block w-full text-left bg-gray-50 hover:bg-indigo-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-600 transition-colors">
                      {hint}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-sm'
                    : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                }`}>
                  {msg.content || <span className="opacity-50">...</span>}
                </div>
              </div>
            ))}
          </div>

          {/* 入力欄 */}
          <div className="flex items-end gap-2 px-3 py-3 border-t border-gray-100">
            <textarea
              value={chatInput}
              onCompositionStart={() => { composingRef.current = true }}
              onCompositionEnd={() => { composingRef.current = false }}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !composingRef.current) { e.preventDefault(); sendChat() } }}
              placeholder="メッセージを入力..."
              rows={2}
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
            <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()}
              className="flex-shrink-0 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white p-2.5 rounded-xl transition-colors">
              {chatLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
