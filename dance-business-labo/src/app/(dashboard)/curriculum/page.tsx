'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CurriculumItem } from '@/types/database'
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Check, X, Loader2, GripVertical, BookOpen } from 'lucide-react'

type TreeItem = CurriculumItem & { children: TreeItem[] }

export default function CurriculumPage() {
  const supabase = createClient()
  const [tree, setTree] = useState<TreeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [addingTo, setAddingTo] = useState<{ parentId: string | null; level: number } | null>(null)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)

  // ドラッグ状態
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [dragBefore, setDragBefore] = useState(false)
  const dragCounter = useRef(0)

  useEffect(() => { load() }, [])

  async function load(silent = false) {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    const { data, error } = await supabase
      .from('curriculum_items')
      .select('*')
      .order('display_order')
      .order('created_at')
    if (error) {
      console.error('curriculum load error:', error)
      setLoading(false)
      setRefreshing(false)
      return
    }
    const flat: CurriculumItem[] = data ?? []
    const roots: TreeItem[] = flat.filter(i => i.parent_id === null).map(i => ({ ...i, children: [] }))
    for (const root of roots) {
      root.children = flat
        .filter(i => i.parent_id === root.id)
        .map(i => ({
          ...i,
          children: flat.filter(j => j.parent_id === i.id).map(j => ({ ...j, children: [] }))
        }))
    }
    setTree(roots)
    setLoading(false)
    setRefreshing(false)
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function startEdit(item: CurriculumItem) {
    setEditingId(item.id)
    setEditName(item.name)
    setAddingTo(null)
  }

  async function saveEdit(id: string) {
    if (!editName.trim()) { setEditingId(null); return }
    setSaving(true)
    const { error } = await supabase.from('curriculum_items').update({ name: editName.trim() }).eq('id', id)
    setSaving(false)
    if (error) { alert(`更新エラー: ${error.message}`); return }
    setEditingId(null)
    load(true)
  }

  async function deleteItem(id: string) {
    if (!confirm('この項目と配下の項目をすべて削除しますか？\nレッスン計画・評価データも削除されます。')) return
    const { error } = await supabase.from('curriculum_items').delete().eq('id', id)
    if (error) { alert(`削除エラー: ${error.message}`); return }
    load(true)
  }

  async function addItem() {
    const name = newName.trim()
    const target = addingTo
    if (!name || !target) return
    setSaving(true)
    const { error } = await supabase.from('curriculum_items').insert({
      parent_id: target.parentId,
      name,
      level: target.level,
      display_order: 99,
    })
    setSaving(false)
    if (error) { alert(`追加エラー: ${error.message}`); return }
    setAddingTo(null)
    setNewName('')
    load(true)
  }

  function startAdd(parentId: string | null, level: number) {
    setAddingTo({ parentId, level })
    setNewName('')
    setEditingId(null)
  }

  // ── ドラッグ＆ドロップ ──
  function onDragStart(e: React.DragEvent, id: string) {
    setDraggedId(id)
    e.dataTransfer.effectAllowed = 'move'
    // 半透明にする
    setTimeout(() => {
      (e.target as HTMLElement).style.opacity = '0.4'
    }, 0)
  }

  function onDragEnd(e: React.DragEvent) {
    ;(e.target as HTMLElement).style.opacity = '1'
    setDraggedId(null)
    setDragOverId(null)
    dragCounter.current = 0
  }

  function onDragOver(e: React.DragEvent, id: string) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverId(id)
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setDragBefore(e.clientY < rect.top + rect.height / 2)
  }

  function onDragLeave() {
    dragCounter.current--
    if (dragCounter.current <= 0) {
      setDragOverId(null)
      dragCounter.current = 0
    }
  }

  function onDragEnter() {
    dragCounter.current++
  }

  async function onDrop(e: React.DragEvent, targetId: string, siblings: TreeItem[]) {
    e.preventDefault()
    const fromId = draggedId
    setDraggedId(null)
    setDragOverId(null)
    dragCounter.current = 0
    if (!fromId || fromId === targetId) return

    const fromIdx = siblings.findIndex(s => s.id === fromId)
    const toIdx = siblings.findIndex(s => s.id === targetId)
    if (fromIdx === -1 || toIdx === -1) return

    // 新しい順序を計算
    const reordered = [...siblings]
    const [moved] = reordered.splice(fromIdx, 1)
    let insertAt = dragBefore ? toIdx : toIdx + 1
    if (fromIdx < toIdx) insertAt--
    reordered.splice(insertAt, 0, moved)

    // DB更新（display_orderを一括更新）
    await Promise.all(
      reordered.map((item, idx) =>
        supabase.from('curriculum_items').update({ display_order: idx + 1 }).eq('id', item.id)
      )
    )
    load(true)
  }

  // ── 共通の編集インライン ──
  function EditInput({ id, size = 'md' }: { id: string; size?: 'sm' | 'md' | 'lg' }) {
    const cls = size === 'lg'
      ? 'flex-1 border border-indigo-300 rounded-lg px-3 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500'
      : size === 'md'
        ? 'flex-1 border border-indigo-300 rounded-lg px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
        : 'flex-1 border border-indigo-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500'
    return (
      <div className="flex-1 flex items-center gap-2">
        <input
          value={editName}
          onChange={e => setEditName(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') saveEdit(id)
            if (e.key === 'Escape') setEditingId(null)
          }}
          className={cls}
          autoFocus
        />
        <button onClick={() => saveEdit(id)} className="text-indigo-600 hover:text-indigo-800 p-1 flex-shrink-0">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
        </button>
        <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600 p-1 flex-shrink-0"><X size={14} /></button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <Loader2 size={24} className="animate-spin mr-2" /> 読み込み中...
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-800">カリキュラム管理</h1>
            {refreshing && <Loader2 size={16} className="animate-spin text-indigo-400" />}
          </div>
          <p className="text-gray-500 text-sm mt-0.5">ダブルクリックで編集 / ドラッグで並び替え</p>
        </div>
        <button
          onClick={() => startAdd(null, 1)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-sm transition-colors"
        >
          <Plus size={16} /> 大項目を追加
        </button>
      </div>

      {/* 大項目追加フォーム */}
      {addingTo?.level === 1 && addingTo.parentId === null && (
        <div className="mb-4 bg-white rounded-xl shadow-sm p-4 flex items-center gap-3 border-2 border-indigo-300">
          <span className="text-xs font-semibold text-indigo-600 w-12 flex-shrink-0">大項目</span>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addItem()}
            placeholder="大項目名を入力"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            autoFocus
          />
          <button onClick={addItem} disabled={saving || !newName.trim()} className="flex items-center gap-1 bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} 追加
          </button>
          <button onClick={() => setAddingTo(null)} className="text-gray-400 hover:text-gray-600 p-1"><X size={16} /></button>
        </div>
      )}

      <div className="space-y-2">
        {tree.map(root => {
          const isOver = dragOverId === root.id
          return (
            <div
              key={root.id}
              draggable
              onDragStart={e => onDragStart(e, root.id)}
              onDragEnd={onDragEnd}
              onDragOver={e => onDragOver(e, root.id)}
              onDragEnter={onDragEnter}
              onDragLeave={onDragLeave}
              onDrop={e => onDrop(e, root.id, tree)}
              className={`bg-white rounded-xl shadow-sm overflow-hidden transition-all ${
                isOver ? (dragBefore ? 'border-t-2 border-indigo-500' : 'border-b-2 border-indigo-500') : 'border-2 border-transparent'
              } ${draggedId === root.id ? 'opacity-40' : ''}`}
            >
              {/* 大項目ヘッダー */}
              <div className="flex items-center gap-2 px-3 py-3.5 bg-indigo-50 border-b border-indigo-100">
                <span className="cursor-grab active:cursor-grabbing text-indigo-300 hover:text-indigo-500 flex-shrink-0 touch-none">
                  <GripVertical size={16} />
                </span>
                <button
                  onClick={() => toggleExpand(root.id)}
                  className="text-indigo-500 hover:text-indigo-700 flex-shrink-0"
                >
                  {expanded.has(root.id) ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </button>
                {editingId === root.id ? (
                  <EditInput id={root.id} size="lg" />
                ) : (
                  <>
                    <span
                      className="flex-1 font-semibold text-indigo-800 cursor-pointer select-none"
                      onDoubleClick={() => startEdit(root)}
                      title="ダブルクリックで編集"
                    >
                      {root.name}
                    </span>
                    <span className="text-xs text-indigo-400 mr-1">{root.children.length}項目</span>
                    <button onClick={() => startEdit(root)} className="text-indigo-300 hover:text-indigo-600 p-1 rounded hover:bg-indigo-100 transition-colors"><Pencil size={13} /></button>
                    <button onClick={() => deleteItem(root.id)} className="text-indigo-200 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors"><Trash2 size={13} /></button>
                  </>
                )}
              </div>

              {/* 中項目 */}
              {expanded.has(root.id) && (
                <div>
                  {root.children.map(mid => {
                    const isMidOver = dragOverId === mid.id
                    return (
                      <div key={mid.id}>
                        <div
                          draggable
                          onDragStart={e => { e.stopPropagation(); onDragStart(e, mid.id) }}
                          onDragEnd={e => { e.stopPropagation(); onDragEnd(e) }}
                          onDragOver={e => { e.stopPropagation(); onDragOver(e, mid.id) }}
                          onDragEnter={e => { e.stopPropagation(); onDragEnter() }}
                          onDragLeave={e => { e.stopPropagation(); onDragLeave() }}
                          onDrop={e => { e.stopPropagation(); onDrop(e, mid.id, root.children) }}
                          className={`flex items-center gap-2 pl-6 pr-4 py-2.5 bg-gray-50 border-b border-gray-100 transition-all ${
                            isMidOver ? (dragBefore ? 'border-t-2 border-indigo-400' : 'border-b-2 border-indigo-400') : ''
                          } ${draggedId === mid.id ? 'opacity-40' : ''}`}
                        >
                          <span className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 flex-shrink-0">
                            <GripVertical size={14} />
                          </span>
                          <button onClick={() => toggleExpand(mid.id)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                            {expanded.has(mid.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                          {editingId === mid.id ? (
                            <EditInput id={mid.id} size="md" />
                          ) : (
                            <>
                              <span
                                className="flex-1 text-sm font-medium text-gray-700 cursor-pointer select-none"
                                onDoubleClick={() => startEdit(mid)}
                                title="ダブルクリックで編集"
                              >
                                {mid.name}
                              </span>
                              <span className="text-xs text-gray-400 mr-1">{(mid.children ?? []).length}項目</span>
                              <button onClick={() => startEdit(mid)} className="text-gray-300 hover:text-indigo-600 p-1 rounded hover:bg-indigo-50 transition-colors"><Pencil size={12} /></button>
                              <button onClick={() => deleteItem(mid.id)} className="text-gray-200 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors"><Trash2 size={12} /></button>
                            </>
                          )}
                        </div>

                        {/* 小項目 */}
                        {expanded.has(mid.id) && (
                          <div>
                            {(mid.children ?? []).map(small => {
                              const isSmallOver = dragOverId === small.id
                              return (
                                <div
                                  key={small.id}
                                  draggable
                                  onDragStart={e => { e.stopPropagation(); onDragStart(e, small.id) }}
                                  onDragEnd={e => { e.stopPropagation(); onDragEnd(e) }}
                                  onDragOver={e => { e.stopPropagation(); onDragOver(e, small.id) }}
                                  onDragEnter={e => { e.stopPropagation(); onDragEnter() }}
                                  onDragLeave={e => { e.stopPropagation(); onDragLeave() }}
                                  onDrop={e => { e.stopPropagation(); onDrop(e, small.id, (mid.children ?? []) as TreeItem[]) }}
                                  className={`flex items-center gap-2 pl-14 pr-4 py-2 border-b border-gray-50 hover:bg-gray-50 transition-all ${
                                    isSmallOver ? (dragBefore ? 'border-t-2 border-indigo-300' : 'border-b-2 border-indigo-300') : ''
                                  } ${draggedId === small.id ? 'opacity-40' : ''}`}
                                >
                                  <span className="cursor-grab active:cursor-grabbing text-gray-200 hover:text-gray-400 flex-shrink-0">
                                    <GripVertical size={13} />
                                  </span>
                                  {editingId === small.id ? (
                                    <EditInput id={small.id} size="sm" />
                                  ) : (
                                    <>
                                      <span
                                        className="flex-1 text-sm text-gray-600 cursor-pointer select-none"
                                        onDoubleClick={() => startEdit(small)}
                                        title="ダブルクリックで編集"
                                      >
                                        {small.name}
                                      </span>
                                      <button onClick={() => startEdit(small)} className="text-gray-200 hover:text-indigo-600 p-1 rounded hover:bg-indigo-50 transition-colors"><Pencil size={11} /></button>
                                      <button onClick={() => deleteItem(small.id)} className="text-gray-200 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors"><Trash2 size={11} /></button>
                                    </>
                                  )}
                                </div>
                              )
                            })}
                            {/* 小項目追加 */}
                            {addingTo?.parentId === mid.id && addingTo.level === 3 ? (
                              <div className="flex items-center gap-2 pl-14 pr-4 py-2 border-b border-gray-50 bg-indigo-50/50">
                                <input
                                  value={newName}
                                  onChange={e => setNewName(e.target.value)}
                                  onKeyDown={e => e.key === 'Enter' && addItem()}
                                  placeholder="小項目名を入力"
                                  className="flex-1 border border-indigo-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                  autoFocus
                                />
                                <button onClick={addItem} disabled={saving} className="text-indigo-600 p-1"><Check size={13} /></button>
                                <button onClick={() => setAddingTo(null)} className="text-gray-400 p-1"><X size={13} /></button>
                              </div>
                            ) : (
                              <button
                                onClick={() => startAdd(mid.id, 3)}
                                className="flex items-center gap-1.5 pl-14 pr-4 py-2 text-xs text-gray-400 hover:text-indigo-600 transition-colors w-full"
                              >
                                <Plus size={11} /> 小項目を追加
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* 中項目追加 */}
                  {addingTo?.parentId === root.id && addingTo.level === 2 ? (
                    <div className="flex items-center gap-2 pl-6 pr-4 py-3 border-b border-gray-100 bg-indigo-50/50">
                      <input
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addItem()}
                        placeholder="中項目名を入力"
                        className="flex-1 border border-indigo-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        autoFocus
                      />
                      <button onClick={addItem} disabled={saving} className="text-indigo-600 p-1"><Check size={14} /></button>
                      <button onClick={() => setAddingTo(null)} className="text-gray-400 p-1"><X size={14} /></button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startAdd(root.id, 2)}
                      className="flex items-center gap-1.5 pl-6 pr-4 py-3 text-xs text-gray-400 hover:text-indigo-600 transition-colors w-full"
                    >
                      <Plus size={12} /> 中項目を追加
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 使い方の説明 */}
      <div className="mt-8 bg-indigo-50 rounded-xl p-5 text-sm text-indigo-700">
        <div className="flex items-center gap-2 mb-2 font-semibold">
          <BookOpen size={16} /> レッスンへの計画の設定方法
        </div>
        <ol className="space-y-1 text-indigo-600 list-decimal list-inside text-xs leading-relaxed">
          <li>「レッスン」ページでレッスン一覧を表示</li>
          <li>各レッスン行の「計画・評価」ボタンをクリック</li>
          <li>「計画」タブでこのカリキュラムの項目を選択・メモを記入</li>
          <li>レッスン後に「評価」タブで生徒ごとに評価（⭐ + メモ）</li>
          <li>「評価を保存・カルテに書き込む」で自動的に各生徒のカルテに記録</li>
        </ol>
      </div>
    </div>
  )
}
