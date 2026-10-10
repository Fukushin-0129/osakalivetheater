'use client'

import { useEffect, useState, use, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Lesson, LessonType, CurriculumItem, LessonPlanItem, LessonEvaluation, Student, LessonVideo } from '@/types/database'
import { ArrowLeft, Plus, Trash2, Star, ChevronDown, ChevronRight, Save, CheckCircle, Loader2, BookOpen, ClipboardList, MessageSquare, Send, X, GripVertical, Video } from 'lucide-react'
import Link from 'next/link'
import { getYouTubeId } from '@/lib/youtube'

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']
const MAX_LESSON_VIDEOS = 3

function parseJST(s: string): Date {
  const clean = s.slice(0, 16).replace(' ', 'T')
  const [y, m, d] = clean.slice(0, 10).split('-').map(Number)
  const [h, min] = clean.slice(11).split(':').map(Number)
  return new Date(y, m - 1, d, h, min)
}

type AttendingStudent = { student_id: string; students: Student | null; notes: string | null }
type EvalMap = Record<string, Record<string, { rating: number; notes: string }>>

export default function LessonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: lessonId } = use(params)
  const supabase = createClient()

  const [lesson, setLesson] = useState<(Lesson & { lesson_types: LessonType | null }) | null>(null)
  const [curriculumTree, setCurriculumTree] = useState<CurriculumItem[]>([])
  const [planItems, setPlanItems] = useState<LessonPlanItem[]>([])
  const [attendingStudents, setAttendingStudents] = useState<AttendingStudent[]>([])
  const [evalMap, setEvalMap] = useState<EvalMap>({})
  const [overallNotes, setOverallNotes] = useState<Record<string, string>>({}) // 生徒ごとのレッスン全体の所感
  const [editingOverallNote, setEditingOverallNote] = useState<string | null>(null) // studentId
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedEval, setSavedEval] = useState(false)
  // 未保存の評価入力がある間に他ページへ移動しようとしたら確認する
  const [evalDirty, setEvalDirty] = useState(false)
  const evalDirtyRef = useRef(false)
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
  const [showCopySourcePicker, setShowCopySourcePicker] = useState(false)
  const [copySourceCandidates, setCopySourceCandidates] = useState<Lesson[]>([])
  const [loadingCopySources, setLoadingCopySources] = useState(false)
  // レッスン動画（YouTube限定公開）
  const [lessonVideos, setLessonVideos] = useState<LessonVideo[]>([])
  const [newVideoUrl, setNewVideoUrl] = useState('')
  const [newVideoLabel, setNewVideoLabel] = useState('')
  const [addingVideo, setAddingVideo] = useState(false)
  const [videoError, setVideoError] = useState<string | null>(null)
  // 計画編集モードでの並び替え（ドラッグ＆ドロップ）
  const [grabbedId, setGrabbedId] = useState<string | null>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [dragBefore, setDragBefore] = useState(false)
  const dragCounter = useRef(0)

  useEffect(() => { loadAll() }, [lessonId])
  useEffect(() => {
    const onMouseUp = () => setGrabbedId(null)
    window.addEventListener('mouseup', onMouseUp)
    return () => window.removeEventListener('mouseup', onMouseUp)
  }, [])

  // 未保存の評価がある状態でページを離れようとしたら確認する
  useEffect(() => { evalDirtyRef.current = evalDirty }, [evalDirty])
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!evalDirtyRef.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    function onClickCapture(e: MouseEvent) {
      if (!evalDirtyRef.current) return
      const anchor = (e.target as HTMLElement).closest('a')
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#')) return
      const destination = new URL(href, window.location.href)
      if (destination.href === window.location.href) return
      e.preventDefault()
      e.stopPropagation()
      if (window.confirm('評価の入力内容が保存されていません。保存せずに移動しますか？')) {
        evalDirtyRef.current = false
        setEvalDirty(false)
        window.location.href = destination.href
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('click', onClickCapture, true)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('click', onClickCapture, true)
    }
  }, [])

  async function loadAll() {
    setLoading(true)
    const [
      { data: lessonData },
      { data: currData },
      { data: planData },
      { data: attendData },
      { data: evalData },
      { data: videoData },
    ] = await Promise.all([
      supabase.from('lessons').select('*, lesson_types(*)').eq('id', lessonId).single(),
      supabase.from('curriculum_items').select('*').order('display_order').order('created_at'),
      supabase.from('lesson_plan_items').select('*, curriculum_items(*)').eq('lesson_id', lessonId),
      supabase.from('attendance').select('student_id, notes, students(*)').eq('lesson_id', lessonId).in('status', ['present', 'late']),
      supabase.from('lesson_evaluations').select('*').eq('lesson_id', lessonId),
      supabase.from('lesson_videos').select('*').eq('lesson_id', lessonId).order('display_order'),
    ])

    setLesson(lessonData as any)
    setLessonVideos((videoData ?? []) as LessonVideo[])

    const flat: CurriculumItem[] = currData ?? []
    const roots = flat.filter(i => !i.parent_id)
    for (const root of roots) {
      root.children = flat.filter(i => i.parent_id === root.id)
      for (const child of root.children) {
        child.children = flat.filter(i => i.parent_id === child.id)
      }
    }
    setCurriculumTree(roots)

    const resolvedPlanItems = (planData ?? []) as LessonPlanItem[]

    setPlanItems(resolvedPlanItems)
    setAttendingStudents((attendData ?? []) as any)
    const overallMap: Record<string, string> = {}
    for (const att of (attendData ?? []) as any[]) {
      if (att.notes) overallMap[att.student_id] = att.notes
    }
    setOverallNotes(overallMap)

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

  // 項目とその配下（中項目→小項目、大項目→中項目・小項目）のIDを再帰的に集める
  function collectIds(item: CurriculumItem): string[] {
    return [item.id, ...(item.children ?? []).flatMap(collectIds)]
  }

  async function togglePlanItem(item: CurriculumItem) {
    if (planItemIds.has(item.id)) {
      // チェックを外した項目に加えて、配下の項目も計画から外す
      const idsToRemove = collectIds(item)
      await supabase.from('lesson_plan_items').delete().eq('lesson_id', lessonId).in('curriculum_item_id', idsToRemove)
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
    await supabase.from('lessons').update({
      plan_status: (data?.length ?? 0) > 0 ? 'planned' : 'not_planned',
      plan_generated_at: new Date().toISOString(),
    }).eq('id', lessonId)
  }

  async function addLessonVideo() {
    setVideoError(null)
    const url = newVideoUrl.trim()
    if (!url) return
    if (!getYouTubeId(url)) {
      setVideoError('YouTubeのURLとして認識できませんでした')
      return
    }
    if (lessonVideos.length >= MAX_LESSON_VIDEOS) {
      setVideoError(`動画は1レッスンにつき最大${MAX_LESSON_VIDEOS}本までです`)
      return
    }
    setAddingVideo(true)
    const { data, error } = await supabase.from('lesson_videos').insert([{
      lesson_id: lessonId,
      url,
      label: newVideoLabel.trim() || null,
      display_order: lessonVideos.length,
    }]).select()
    setAddingVideo(false)
    if (error) {
      setVideoError(`保存に失敗しました: ${error.message}`)
      return
    }
    setLessonVideos(prev => [...prev, ...(data as LessonVideo[])])
    setNewVideoUrl('')
    setNewVideoLabel('')
  }

  async function deleteLessonVideo(id: string) {
    if (!window.confirm('この動画リンクを削除しますか？')) return
    await supabase.from('lesson_videos').delete().eq('id', id)
    setLessonVideos(prev => prev.filter(v => v.id !== id))
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

  // 計画していたが実際には行わなかった項目を「スキップ」としてマーク（記録は残したまま評価対象から外す）
  async function toggleSkipped(planItem: LessonPlanItem) {
    const next = !planItem.skipped
    await supabase.from('lesson_plan_items').update({ skipped: next }).eq('id', planItem.id)
    setPlanItems(prev => prev.map(p => p.id === planItem.id ? { ...p, skipped: next } : p))
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
    setEvalDirty(true)
  }

  function setOverallNote(studentId: string, value: string) {
    setOverallNotes(prev => ({ ...prev, [studentId]: value }))
    setEvalDirty(true)
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
      const recordDate = lesson.scheduled_at.slice(0, 10)
      const headerPrefix = `【レッスン評価: ${lessonDate} ${lesson.title}】`

      // 同じ日・同じレッスンのカルテ記録は上書きするため、既存分を先に取得
      const { data: existingRecords } = await supabase
        .from('student_records')
        .select('id, student_id, content')
        .eq('record_date', recordDate)
        .in('student_id', attendingStudents.map(a => a.student_id))

      // 全体の所感を attendance.notes に保存
      for (const att of attendingStudents) {
        const overall = overallNotes[att.student_id] ?? ''
        if (overall !== (att.notes ?? '')) {
          await supabase.from('attendance').update({ notes: overall || null })
            .eq('lesson_id', lessonId).eq('student_id', att.student_id)
        }
      }

      for (const att of attendingStudents) {
        const studentId = att.student_id
        const studentEvals = evalMap[studentId]
        const existing = (existingRecords ?? []).find(r => r.student_id === studentId && r.content.startsWith(headerPrefix))
        const overallNote = overallNotes[studentId]?.trim()
        const lines: string[] = [headerPrefix]
        if (overallNote) lines.push(`◆ 全体の所感: ${overallNote}`)
        for (const planItem of planItems) {
          const item = planItem.curriculum_items as CurriculumItem | null
          if (!item) continue
          const val = studentEvals?.[item.id]
          if (!val?.notes) continue
          const parentName = item.parent_id
            ? curriculumTree.flatMap(r => r.children ?? []).find(c => c.id === item.parent_id)?.name ?? ''
            : ''
          const label = parentName ? `${parentName} > ${item.name}` : item.name
          lines.push(`● ${label}: ${val.notes}`)
        }
        if (lines.length > 1) {
          if (existing) {
            await supabase.from('student_records').update({ content: lines.join('\n') }).eq('id', existing.id)
          } else {
            await supabase.from('student_records').insert({
              student_id: studentId, record_date: recordDate, content: lines.join('\n'),
            })
          }
        } else if (existing) {
          // 評価メモが全て削除された場合は、以前作成したカルテ記録も削除
          await supabase.from('student_records').delete().eq('id', existing.id)
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
    setEvalDirty(false)
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

  // 計画編集モードでの並び替え（カリキュラム全体の display_order を更新するので /curriculum の並びにも反映される）
  function onDragStart(e: React.DragEvent, id: string) {
    setDraggedId(id)
    e.dataTransfer.effectAllowed = 'move'
    setTimeout(() => { (e.target as HTMLElement).style.opacity = '0.4' }, 0)
  }
  function onDragEnd(e: React.DragEvent) {
    ;(e.target as HTMLElement).style.opacity = '1'
    setDraggedId(null); setDragOverId(null); setGrabbedId(null); dragCounter.current = 0
  }
  function onDragOver(e: React.DragEvent, id: string) {
    e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverId(id)
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setDragBefore(e.clientY < rect.top + rect.height / 2)
  }
  function onDragLeave() { dragCounter.current--; if (dragCounter.current <= 0) { setDragOverId(null); dragCounter.current = 0 } }
  function onDragEnter() { dragCounter.current++ }
  async function onDrop(e: React.DragEvent, targetId: string, siblings: CurriculumItem[]) {
    e.preventDefault()
    const fromId = draggedId
    setDraggedId(null); setDragOverId(null); setGrabbedId(null); dragCounter.current = 0
    if (!fromId || fromId === targetId) return
    const fromIdx = siblings.findIndex(s => s.id === fromId)
    const toIdx = siblings.findIndex(s => s.id === targetId)
    if (fromIdx === -1 || toIdx === -1) return
    const reordered = [...siblings]
    const [moved] = reordered.splice(fromIdx, 1)
    let insertAt = dragBefore ? toIdx : toIdx + 1
    if (fromIdx < toIdx) insertAt--
    reordered.splice(insertAt, 0, moved)
    await Promise.all(reordered.map((item, idx) => supabase.from('curriculum_items').update({ display_order: idx + 1 }).eq('id', item.id)))
    loadAll()
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
    if (!window.confirm('前週の同じ時間のレッスンからカリキュラムをコピーします。よろしいですか？')) return
    await runCopyCurriculum()
  }

  async function openCopySourcePicker() {
    if (!lesson) return
    setShowCopySourcePicker(true)
    setLoadingCopySources(true)
    try {
      const base = () => supabase
        .from('lessons')
        .select('*, lesson_types(*)')
        .lt('scheduled_at', lesson.scheduled_at)
        .neq('id', lesson.id)
        .order('scheduled_at', { ascending: false })
        .limit(30)

      let data: Lesson[] | null = null
      if (lesson.lesson_type_id) {
        const res = await base().eq('lesson_type_id', lesson.lesson_type_id)
        data = res.data as Lesson[] | null
      }
      // 同じ種別のレッスンが見つからない場合（種別未設定なども含む）は全件から選べるようにする
      if (!data || data.length === 0) {
        const res = await base()
        data = res.data as Lesson[] | null
      }
      setCopySourceCandidates(data ?? [])
    } finally {
      setLoadingCopySources(false)
    }
  }

  async function runCopyCurriculum(sourceLessonId?: string) {
    if (!lesson) return
    setCopyingFromPrevious(true)
    try {
      const res = await fetch(`/api/lessons/${lesson.id}/copy-curriculum`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sourceLessonId ? { source_lesson_id: sourceLessonId } : {}),
      })
      if (!res.ok) {
        const error = await res.json()
        alert(`エラー: ${error.error}`)
        return
      }
      const data = await res.json()
      alert(`✅ ${data.copied_from} からカリキュラムをコピーしました（${data.items_count}項目）`)
      setShowCopySourcePicker(false)
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

      {/* レッスン動画（YouTube限定公開） */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Video size={15} className="text-indigo-600" />
          <h2 className="font-semibold text-gray-700 text-sm">レッスン動画</h2>
          <span className="text-xs text-gray-400">(YouTube限定公開・最大{MAX_LESSON_VIDEOS}本)</span>
        </div>

        {lessonVideos.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
            {lessonVideos.map(v => {
              const ytId = getYouTubeId(v.url)
              return (
                <div key={v.id} className="relative group">
                  <a href={v.url} target="_blank" rel="noopener noreferrer" className="block">
                    {ytId ? (
                      <img src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`} alt={v.label ?? 'レッスン動画'}
                        className="w-full aspect-video object-cover rounded-lg border border-gray-200" />
                    ) : (
                      <div className="w-full aspect-video rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-300">
                        <Video size={20} />
                      </div>
                    )}
                  </a>
                  {v.label && <p className="text-xs text-gray-500 mt-1 truncate">{v.label}</p>}
                  <button onClick={() => deleteLessonVideo(v.id)}
                    className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 transition-opacity">
                    <Trash2 size={14} />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {lessonVideos.length < MAX_LESSON_VIDEOS && (
          <div className="flex flex-col sm:flex-row gap-2">
            <input value={newVideoUrl} onChange={e => setNewVideoUrl(e.target.value)}
              placeholder="YouTube限定公開の動画URL"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <input value={newVideoLabel} onChange={e => setNewVideoLabel(e.target.value)}
              placeholder="メモ（任意）"
              className="sm:w-40 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <button onClick={addLessonVideo} disabled={addingVideo || !newVideoUrl.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-4 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap">
              {addingVideo ? '追加中...' : '追加'}
            </button>
          </div>
        )}
        {videoError && <p className="text-xs text-red-500 mt-2">{videoError}</p>}
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
                        <button
                          onClick={openCopySourcePicker}
                          disabled={copyingFromPrevious}
                          className="mt-1 block mx-auto text-gray-400 hover:text-gray-600 disabled:text-gray-300 underline text-[11px]"
                        >
                          コピー元を選択する
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
                                            <span className={`text-xs ${smallPlanItem?.skipped ? 'text-gray-400 line-through' : 'text-gray-600'}`}>{small.name}</span>
                                            {smallPlanItem?.skipped && (
                                              <span className="text-[9px] text-gray-400 bg-gray-100 px-1 rounded flex-shrink-0">未実施</span>
                                            )}
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
                        <div className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-100">
                          <button onClick={() => togglePlanItem(root)}
                            className={`w-4 h-4 rounded flex-shrink-0 border-2 transition-colors flex items-center justify-center ${planItemIds.has(root.id) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 hover:border-indigo-400'}`}>
                            {planItemIds.has(root.id) && <span className="text-white text-[10px] font-bold">✓</span>}
                          </button>
                          <button
                            onClick={() => setExpandedItems(prev => {
                              const next = new Set(prev); next.has(root.id) ? next.delete(root.id) : next.add(root.id); return next
                            })}
                            className="flex-1 flex items-center justify-between text-left">
                            <span className="font-semibold text-gray-800 text-sm">{root.name}</span>
                            {expandedItems.has(root.id) ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                          </button>
                        </div>
                        {expandedItems.has(root.id) && (
                          <div className="border-b border-gray-100">
                            {(root.children ?? []).map(mid => (
                              <div key={mid.id}
                                draggable={grabbedId === mid.id}
                                onDragStart={e => onDragStart(e, mid.id)}
                                onDragEnd={onDragEnd}
                                onDragOver={e => onDragOver(e, mid.id)}
                                onDragEnter={onDragEnter}
                                onDragLeave={onDragLeave}
                                onDrop={e => onDrop(e, mid.id, root.children ?? [])}
                                className={`${dragOverId === mid.id ? (dragBefore ? 'border-t-2 border-indigo-300' : 'border-b-2 border-indigo-300') : ''} ${draggedId === mid.id ? 'opacity-40' : ''}`}>
                                <div className="flex items-center gap-2 px-4 py-2 bg-gray-50/60 border-b border-gray-50">
                                  <span className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-400 flex-shrink-0"
                                    onMouseDown={() => setGrabbedId(mid.id)}><GripVertical size={12} /></span>
                                  <button onClick={() => togglePlanItem(mid)}
                                    className={`w-4 h-4 rounded flex-shrink-0 border-2 transition-colors flex items-center justify-center ${planItemIds.has(mid.id) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 hover:border-indigo-400'}`}>
                                    {planItemIds.has(mid.id) && <span className="text-white text-[10px] font-bold">✓</span>}
                                  </button>
                                  <span className="text-xs font-medium text-gray-700">{mid.name}</span>
                                </div>
                                {(mid.children ?? []).map(small => (
                                  <div key={small.id}
                                    draggable={grabbedId === small.id}
                                    onDragStart={e => { e.stopPropagation(); onDragStart(e, small.id) }}
                                    onDragEnd={e => { e.stopPropagation(); onDragEnd(e) }}
                                    onDragOver={e => { e.stopPropagation(); onDragOver(e, small.id) }}
                                    onDragEnter={e => { e.stopPropagation(); onDragEnter() }}
                                    onDragLeave={e => { e.stopPropagation(); onDragLeave() }}
                                    onDrop={e => { e.stopPropagation(); onDrop(e, small.id, mid.children ?? []) }}
                                    className={`flex items-center gap-2 pl-9 pr-4 py-2 border-b border-gray-50 ${dragOverId === small.id ? (dragBefore ? 'border-t-2 border-indigo-300' : 'border-b-2 border-indigo-300') : ''} ${draggedId === small.id ? 'opacity-40' : ''}`}>
                                    <span className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-400 flex-shrink-0"
                                      onMouseDown={() => setGrabbedId(small.id)}><GripVertical size={11} /></span>
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
              <div className="bg-white rounded-xl shadow-sm overflow-auto" style={{ maxHeight: '75vh' }}>
                <div className="min-w-max">
                  {/* 生徒名ヘッダー（横並び・スクロールしても常に見えるよう固定） */}
                  <div className="flex border-b border-gray-100 bg-gray-50 sticky top-0 z-10">
                    <div className="w-48 flex-shrink-0 px-4 py-2.5" />
                    {attendingStudents.map(att => (
                      <div key={att.student_id} className="w-36 flex-shrink-0 px-2 py-2.5 text-center border-l border-gray-100">
                        <span className="text-xs font-semibold text-gray-800">{att.students?.name ?? '—'}</span>
                        {att.students?.name_kana && <div className="text-[10px] text-gray-400">{att.students.name_kana}</div>}
                      </div>
                    ))}
                  </div>

                  {/* レッスン全体の所感 */}
                  <div className="flex items-stretch border-b-2 border-amber-100 bg-amber-50/30">
                    <div className="w-48 flex-shrink-0 px-4 py-3">
                      <span className="text-sm font-semibold text-amber-700">レッスン全体の所感</span>
                    </div>
                    {attendingStudents.map(att => (
                      <div key={att.student_id} className="w-36 flex-shrink-0 px-2 py-3 border-l border-amber-100">
                        {editingOverallNote === att.student_id ? (
                          <textarea
                            defaultValue={overallNotes[att.student_id] ?? ''}
                            onCompositionStart={() => { composingRef.current = true }}
                            onCompositionEnd={e => { composingRef.current = false; setOverallNote(att.student_id, (e.target as HTMLTextAreaElement).value) }}
                            onChange={e => { if (!composingRef.current) setOverallNote(att.student_id, e.target.value) }}
                            onBlur={() => setEditingOverallNote(null)}
                            placeholder="今日の全体的な様子"
                            rows={3}
                            autoFocus
                            className="w-full border border-amber-300 rounded-lg px-2 py-1 text-[11px] focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" />
                        ) : (
                          <p onClick={() => setEditingOverallNote(att.student_id)}
                            className={`text-[11px] leading-tight cursor-pointer ${overallNotes[att.student_id] ? 'text-gray-700' : 'text-gray-300'}`}>
                            {overallNotes[att.student_id] || '+ 記入する'}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

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
                                const isSkipped = pi?.skipped ?? false
                                return (
                                  <div key={small.id} className={`flex items-stretch border-t border-gray-50 ${isSkipped ? 'bg-gray-50/60' : ''}`}>
                                    <div className="w-48 flex-shrink-0 px-4 py-3 flex items-start gap-2">
                                      <button
                                        onClick={() => pi && toggleSkipped(pi)}
                                        title={isSkipped ? '実施した項目に戻す' : '実際には行わなかった項目としてマーク'}
                                        className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${isSkipped ? 'border-gray-300 bg-gray-200' : 'border-indigo-400 bg-indigo-500'}`}>
                                        {!isSkipped && <span className="text-white text-[9px] font-bold">✓</span>}
                                      </button>
                                      <div className="min-w-0">
                                        <span className={`text-sm ${isSkipped ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{small.name}</span>
                                        {isSkipped && <p className="text-[10px] text-gray-400">未実施（計画のみ）</p>}
                                        {pi?.plan_notes && !isSkipped && (
                                          <p className="text-xs text-indigo-400 mt-0.5">計画: {pi.plan_notes}</p>
                                        )}
                                      </div>
                                    </div>
                                    {attendingStudents.map(att => {
                                      const val = evalMap[att.student_id]?.[small.id]
                                      const editKey = `${att.student_id}:${small.id}`
                                      if (isSkipped) {
                                        return (
                                          <div key={att.student_id} className="w-36 flex-shrink-0 px-2 py-3 border-l border-gray-50 flex items-center justify-center">
                                            <span className="text-[11px] text-gray-300">—</span>
                                          </div>
                                        )
                                      }
                                      return (
                                        <div key={att.student_id} className="w-36 flex-shrink-0 px-2 py-3 border-l border-gray-50 flex flex-col items-center gap-1">
                                          <div className="flex items-center gap-1">
                                            <button
                                              onClick={() => setEval(att.student_id, small.id, 'rating', (val?.rating ?? 0) > 0 ? 0 : 1)}
                                              className={`transition-colors ${(val?.rating ?? 0) > 0 ? 'text-yellow-400' : 'text-gray-200 hover:text-yellow-300'}`}
                                              title="特筆すべき点があればマーク">
                                              <Star size={18} fill={(val?.rating ?? 0) > 0 ? 'currentColor' : 'none'} />
                                            </button>
                                            {editingEvalNote !== editKey && (
                                              <button onClick={() => setEditingEvalNote(editKey)}
                                                className="text-gray-300 hover:text-indigo-400">
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                              </button>
                                            )}
                                          </div>
                                          {val?.notes && editingEvalNote !== editKey && (
                                            <p className="text-[11px] text-gray-600 text-center cursor-pointer leading-tight" onClick={() => setEditingEvalNote(editKey)}>{val.notes}</p>
                                          )}
                                          {editingEvalNote === editKey && (
                                            <textarea
                                              defaultValue={val?.notes ?? ''}
                                              onCompositionStart={() => { composingRef.current = true }}
                                              onCompositionEnd={e => { composingRef.current = false; setEval(att.student_id, small.id, 'notes', (e.target as HTMLTextAreaElement).value) }}
                                              onChange={e => { if (!composingRef.current) setEval(att.student_id, small.id, 'notes', e.target.value) }}
                                              onBlur={() => setEditingEvalNote(null)}
                                              placeholder="メモ"
                                              rows={2}
                                              autoFocus
                                              className="w-full border border-indigo-300 rounded-lg px-2 py-1 text-[11px] focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
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
                    )
                  })}
                </div>
              </div>

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

      {showCopySourcePicker && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-800">コピー元のレッスンを選択</h2>
              <button onClick={() => setShowCopySourcePicker(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="overflow-y-auto px-3 py-2">
              {loadingCopySources ? (
                <div className="flex items-center justify-center py-10 text-gray-400">
                  <Loader2 size={20} className="animate-spin mr-2" /> 読み込み中...
                </div>
              ) : copySourceCandidates.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-10">同じレッスン種別の過去のレッスンが見つかりません</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {copySourceCandidates.map(l => {
                    const d = parseJST(l.scheduled_at)
                    return (
                      <li key={l.id}>
                        <button
                          onClick={() => runCopyCurriculum(l.id)}
                          disabled={copyingFromPrevious}
                          className="w-full text-left px-3 py-3 hover:bg-indigo-50 rounded-lg flex items-center justify-between disabled:opacity-50"
                        >
                          <span className="text-sm text-gray-700">{l.title}</span>
                          <span className="text-xs text-gray-400">
                            {d.getFullYear()}/{d.getMonth() + 1}/{d.getDate()}（{WEEKDAYS[d.getDay()]}）{String(d.getHours()).padStart(2, '0')}:{String(d.getMinutes()).padStart(2, '0')}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
