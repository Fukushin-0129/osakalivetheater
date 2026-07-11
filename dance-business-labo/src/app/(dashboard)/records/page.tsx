'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Student, StudentRecord, LessonEvaluation, CurriculumItem, Lesson } from '@/types/database'
import { Plus, Trash2, FileText, Pencil, Check, X, Search, Loader2, ChevronDown, Star, MessageSquare, Send, Target, BookOpen } from 'lucide-react'

type EvalWithContext = LessonEvaluation & {
  curriculum_items: CurriculumItem | null
  lessons: Lesson | null
}

type TimelineItem =
  | { type: 'record'; date: string; data: StudentRecord }
  | { type: 'lesson'; date: string; lessonTitle: string; lessonId: string; evals: EvalWithContext[] }

export default function RecordsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [search, setSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [records, setRecords] = useState<StudentRecord[]>([])
  const [evals, setEvals] = useState<EvalWithContext[]>([])
  const [loadingRecords, setLoadingRecords] = useState(false)
  const [saving, setSaving] = useState(false)
  const [goalText, setGoalText] = useState('')
  const [goalSaving, setGoalSaving] = useState(false)
  const [goalSaved, setGoalSaved] = useState(false)

  // 新規入力
  const [newContent, setNewContent] = useState('')
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0])

  // 編集中
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  // レッスン評価（項目ごとのメモ）の編集中
  const [editingEvalId, setEditingEvalId] = useState<string | null>(null)

  // AIチャット
  const [chatOpen, setChatOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const composingRef = useRef(false)

  const dropdownRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('students').select('id, name, name_kana').eq('is_active', true).order('name_kana')
      .then(({ data }) => setStudents(data as Student[] ?? []))
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filteredStudents = students.filter(s =>
    !search || s.name.includes(search) || (s.name_kana ?? '').includes(search)
  )

  async function selectStudent(s: Student) {
    setSelectedStudent(s)
    setShowDropdown(false)
    setSearch('')
    setLoadingRecords(true)
    setChatMessages([])

    const [{ data: recs }, { data: evData }, { data: stuData }] = await Promise.all([
      supabase.from('student_records').select('*').eq('student_id', s.id).order('record_date', { ascending: false }),
      supabase.from('lesson_evaluations').select('*, curriculum_items(*), lessons(*)').eq('student_id', s.id).order('created_at', { ascending: false }),
      supabase.from('students').select('goal').eq('id', s.id).single(),
    ])

    setRecords(recs ?? [])
    setEvals((evData ?? []) as EvalWithContext[])
    setGoalText((stuData as any)?.goal ?? '')
    setLoadingRecords(false)
  }

  async function addRecord() {
    if (!selectedStudent || !newContent.trim()) return
    setSaving(true)
    const { data } = await supabase
      .from('student_records')
      .insert({ student_id: selectedStudent.id, content: newContent.trim(), record_date: newDate })
      .select().single()
    if (data) setRecords(prev => [data, ...prev])
    setNewContent('')
    setNewDate(new Date().toISOString().split('T')[0])
    setSaving(false)
  }

  async function deleteRecord(id: string) {
    if (!confirm('この記録を削除しますか？')) return
    await supabase.from('student_records').delete().eq('id', id)
    setRecords(prev => prev.filter(r => r.id !== id))
  }

  async function saveEdit(id: string) {
    if (!editContent.trim()) return
    await supabase.from('student_records').update({ content: editContent.trim() }).eq('id', id)
    setRecords(prev => prev.map(r => r.id === id ? { ...r, content: editContent.trim() } : r))
    setEditingId(null)
  }

  async function updateEval(id: string, field: 'notes' | 'rating', value: string | number) {
    await supabase.from('lesson_evaluations').update({ [field]: value || null }).eq('id', id)
    setEvals(prev => prev.map(e => e.id === id ? { ...e, [field]: value } as EvalWithContext : e))
  }

  async function deleteEval(id: string) {
    if (!confirm('この評価項目を削除しますか？')) return
    await supabase.from('lesson_evaluations').delete().eq('id', id)
    setEvals(prev => prev.filter(e => e.id !== id))
  }

  async function saveGoal() {
    if (!selectedStudent) return
    setGoalSaving(true)
    await supabase.from('students').update({ goal: goalText }).eq('id', selectedStudent.id)
    setSelectedStudent(prev => prev ? { ...prev, goal: goalText } : prev)
    setGoalSaving(false)
    setGoalSaved(true)
    setTimeout(() => setGoalSaved(false), 2000)
  }

  async function sendChat() {
    if (!chatInput.trim() || chatLoading || !selectedStudent) return
    const userMsg = { role: 'user' as const, content: chatInput.trim() }
    const newMessages = [...chatMessages, userMsg]
    setChatMessages(newMessages)
    setChatInput('')
    setChatLoading(true)

    const recentRecords = records.slice(0, 5).map(r =>
      `[${r.record_date}] ${r.content.slice(0, 200)}`
    ).join('\n')

    const recentEvals = evals.slice(0, 10).map(e => {
      const item = e.curriculum_items
      const lesson = e.lessons
      if (!item) return null
      return `[${lesson?.scheduled_at?.slice(0, 10) ?? ''}] ${item.name}: ${e.rating ? '★特筆' : ''} ${e.notes ?? ''}`
    }).filter(Boolean).join('\n')

    const studentContext = `生徒名: ${selectedStudent.name}
目標・なりたい姿: ${goalText || '（未設定）'}

## 最近のレッスン評価（新しい順）
${recentEvals || '（記録なし）'}

## 最近のカルテ記録（新しい順）
${recentRecords || '（記録なし）'}`

    try {
      const res = await fetch('/api/records/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, studentContext }),
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
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'エラーが発生しました。' }])
    }
    setChatLoading(false)
  }

  // タイムライン生成（記録＋レッスン評価を日付でまとめる）
  const timeline: TimelineItem[] = []
  for (const r of records) {
    timeline.push({ type: 'record', date: r.record_date, data: r })
  }
  const lessonGroups: Record<string, { title: string; date: string; evals: EvalWithContext[] }> = {}
  for (const e of evals) {
    const lesson = e.lessons
    if (!lesson) continue
    const key = lesson.id
    if (!lessonGroups[key]) {
      lessonGroups[key] = { title: lesson.title, date: lesson.scheduled_at.slice(0, 10), evals: [] }
    }
    lessonGroups[key].evals.push(e)
  }
  for (const [lessonId, group] of Object.entries(lessonGroups)) {
    if (group.evals.some(e => e.rating || e.notes)) {
      timeline.push({ type: 'lesson', date: group.date, lessonTitle: group.title, lessonId, evals: group.evals })
    }
  }
  timeline.sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">カルテ管理</h1>
        <p className="text-gray-500 text-sm mt-0.5">生徒ごとの記録・レッスン評価・成長相談</p>
      </div>

      {/* 生徒選択 */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-4" ref={dropdownRef}>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">生徒を選択</label>
        <div className="relative">
          <button type="button" onClick={() => setShowDropdown(v => !v)}
            className="w-full flex items-center justify-between border border-gray-200 rounded-xl px-3 py-2.5 text-sm hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white transition-colors">
            {selectedStudent ? (
              <span className="font-medium text-gray-800">
                {selectedStudent.name}
                {selectedStudent.name_kana && <span className="text-gray-400 font-normal ml-2 text-xs">{selectedStudent.name_kana}</span>}
              </span>
            ) : (
              <span className="text-gray-400">生徒を選んでください</span>
            )}
            <ChevronDown size={16} className={`text-gray-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
          </button>
          {showDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-30 overflow-hidden">
              <div className="p-2 border-b border-gray-100">
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input autoFocus type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="名前・よみがなで絞り込み"
                    className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div className="max-h-56 overflow-y-auto">
                {filteredStudents.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-gray-400 text-center">見つかりません</div>
                ) : filteredStudents.map(s => (
                  <button key={s.id} onClick={() => selectStudent(s)}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-indigo-50 transition-colors flex items-center justify-between ${selectedStudent?.id === s.id ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700'}`}>
                    <span>{s.name}</span>
                    {s.name_kana && <span className="text-xs text-gray-400 ml-2">{s.name_kana}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedStudent && (
        <div className="grid lg:grid-cols-[1fr_320px] gap-4 items-start">
          {/* タイムライン */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-700 px-1">
              記録タイムライン
              {!loadingRecords && <span className="text-gray-400 font-normal ml-1">（{timeline.length}件）</span>}
            </h2>

            {loadingRecords ? (
              <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-400">
                <Loader2 size={22} className="animate-spin mx-auto" />
              </div>
            ) : timeline.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm p-10 text-center text-gray-400">
                <FileText size={30} className="mx-auto mb-2 opacity-20" />
                <p className="text-sm">記録がありません</p>
              </div>
            ) : timeline.map((item, idx) => (
              <div key={idx} className="bg-white rounded-xl shadow-sm overflow-hidden">
                {item.type === 'record' ? (
                  // カルテ記録
                  <div className="p-4 group">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <FileText size={13} className="text-indigo-400" />
                        <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
                          {new Date(item.date + 'T00:00:00').toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
                        </span>
                        <span className="text-xs text-gray-400">カルテ記録</span>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {editingId === item.data.id ? (
                          <>
                            <button onClick={() => saveEdit(item.data.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"><Check size={14} /></button>
                            <button onClick={() => setEditingId(null)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"><X size={14} /></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => { setEditingId(item.data.id); setEditContent(item.data.content) }} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><Pencil size={14} /></button>
                            <button onClick={() => deleteRecord(item.data.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                          </>
                        )}
                      </div>
                    </div>
                    {editingId === item.data.id ? (
                      <textarea value={editContent} onChange={e => setEditContent(e.target.value)} rows={4} autoFocus
                        className="w-full border border-indigo-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    ) : (
                      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{item.data.content}</p>
                    )}
                  </div>
                ) : (
                  // レッスン評価
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <BookOpen size={13} className="text-emerald-500" />
                      <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
                        {new Date(item.date + 'T00:00:00').toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
                      </span>
                      <span className="text-xs text-gray-500 font-medium">{item.lessonTitle}</span>
                    </div>
                    <div className="space-y-2">
                      {item.evals.filter(e => e.rating || e.notes).map(e => (
                        <div key={e.id} className="flex items-start gap-3 pl-2 group/eval">
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-medium text-gray-700">{e.curriculum_items?.name ?? '—'}</span>
                            {editingEvalId === e.id ? (
                              <textarea
                                defaultValue={e.notes ?? ''}
                                onCompositionStart={() => { composingRef.current = true }}
                                onCompositionEnd={ev => { composingRef.current = false; updateEval(e.id, 'notes', (ev.target as HTMLTextAreaElement).value) }}
                                onChange={ev => { if (!composingRef.current) updateEval(e.id, 'notes', ev.target.value) }}
                                onBlur={() => setEditingEvalId(null)}
                                rows={2}
                                autoFocus
                                className="mt-1 w-full border border-indigo-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                            ) : (
                              e.notes && (
                                <p className="text-xs text-gray-500 mt-0.5 cursor-pointer" onClick={() => setEditingEvalId(e.id)}>{e.notes}</p>
                              )
                            )}
                          </div>
                          <button
                            onClick={() => updateEval(e.id, 'rating', e.rating ? 0 : 1)}
                            className="flex-shrink-0 transition-colors" title="特筆すべき点があればマーク">
                            <Star size={14} className={e.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 hover:text-yellow-300'} />
                          </button>
                          <div className="flex-shrink-0 flex gap-0.5 opacity-0 group-hover/eval:opacity-100 transition-opacity">
                            {editingEvalId !== e.id && (
                              <button onClick={() => setEditingEvalId(e.id)} className="p-1 text-gray-300 hover:text-indigo-500 hover:bg-indigo-50 rounded"><Pencil size={11} /></button>
                            )}
                            <button onClick={() => deleteEval(e.id)} className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded"><Trash2 size={11} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 右カラム */}
          <div className="space-y-4">
            {/* 目標・なりたい姿 */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Target size={15} className="text-rose-500" /> 目標・なりたい姿
              </h2>
              <textarea
                value={goalText}
                onCompositionStart={() => { composingRef.current = true }}
                onCompositionEnd={e => { composingRef.current = false; setGoalText((e.target as HTMLTextAreaElement).value) }}
                onChange={e => { if (!composingRef.current) setGoalText(e.target.value) }}
                rows={4}
                placeholder={`${selectedStudent.name}さんが目指していること、できるようになりたいこと...`}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 resize-none"
              />
              <button onClick={saveGoal} disabled={goalSaving}
                className="mt-2 w-full flex items-center justify-center gap-2 bg-rose-500 hover:bg-rose-600 disabled:bg-rose-300 text-white py-2 rounded-xl text-xs font-medium transition-colors">
                {goalSaving ? <Loader2 size={13} className="animate-spin" /> : goalSaved ? <Check size={13} /> : null}
                {goalSaved ? '保存しました' : '目標を保存'}
              </button>

              {/* AI成長相談ボタン */}
              <button onClick={() => setChatOpen(v => !v)}
                className="mt-2 w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">
                <MessageSquare size={14} />
                成長をAIに相談する
              </button>
            </div>

            {/* 新規記録追加 */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Plus size={15} className="text-indigo-500" /> 新規記録を追加
              </h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">記録日</label>
                  <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">内容</label>
                  <textarea value={newContent}
                    onCompositionStart={() => { composingRef.current = true }}
                    onCompositionEnd={e => { composingRef.current = false; setNewContent((e.target as HTMLTextAreaElement).value) }}
                    onChange={e => { if (!composingRef.current) setNewContent(e.target.value) }}
                    rows={5}
                    placeholder={`${selectedStudent.name}さんのレッスン内容、身体の状態、課題、気づきなど...`}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                  <p className="text-right text-xs text-gray-400 mt-0.5">{newContent.length}文字</p>
                </div>
                <button onClick={addRecord} disabled={saving || !newContent.trim()}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  {saving ? '保存中...' : '記録を追加'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!selectedStudent && (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-400">
          <FileText size={36} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">上のセレクトから生徒を選んでください</p>
        </div>
      )}

      {/* AIチャットパネル */}
      {chatOpen && selectedStudent && (
        <div className="fixed bottom-6 right-6 z-50 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col" style={{ maxHeight: '70vh' }}>
          <div className="flex items-center justify-between px-4 py-3 bg-indigo-600 rounded-t-2xl">
            <div className="flex items-center gap-2">
              <MessageSquare size={15} className="text-white" />
              <span className="text-sm font-semibold text-white">{selectedStudent.name}さんの成長相談</span>
            </div>
            <button onClick={() => setChatOpen(false)} className="text-indigo-200 hover:text-white">
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
            {chatMessages.length === 0 && (
              <div className="text-center text-gray-400 text-xs py-6">
                <p className="mb-2">この生徒の成長について相談できます</p>
                <div className="space-y-1">
                  {['次に何を伸ばせばいい？', '目標に向けた練習方法は？', 'この生徒の強みと課題は？'].map(hint => (
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
                  msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                }`}>
                  {msg.content || <span className="opacity-50">...</span>}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-end gap-2 px-3 py-3 border-t border-gray-100">
            <textarea value={chatInput}
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
