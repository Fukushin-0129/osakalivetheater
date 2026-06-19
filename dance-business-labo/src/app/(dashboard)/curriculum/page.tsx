'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CurriculumItem } from '@/types/database'
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Check, X, Loader2, GripVertical, BookOpen } from 'lucide-react'

type TreeItem = CurriculumItem & { children: TreeItem[] }

const LEVEL_LABELS = ['', '大項目', '中項目', '小項目']
const LEVEL_COLORS = ['', 'text-indigo-700 bg-indigo-50', 'text-gray-700 bg-gray-50', 'text-gray-500 bg-white']

export default function CurriculumPage() {
  const supabase = createClient()
  const [tree, setTree] = useState<TreeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [addingTo, setAddingTo] = useState<{ parentId: string | null; level: number } | null>(null)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('curriculum_items').select('*').order('level').order('display_order').order('created_at')
    const flat: CurriculumItem[] = data ?? []

    const roots: TreeItem[] = flat.filter(i => !i.parent_id).map(i => ({ ...i, children: [] }))
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
    if (!editName.trim()) return
    setSaving(true)
    await supabase.from('curriculum_items').update({ name: editName.trim() }).eq('id', id)
    setSaving(false)
    setEditingId(null)
    load()
  }

  async function deleteItem(id: string) {
    if (!confirm('この項目と配下の項目をすべて削除しますか？\nレッスン計画・評価データも削除されます。')) return
    await supabase.from('curriculum_items').delete().eq('id', id)
    load()
  }

  async function addItem() {
    if (!newName.trim() || !addingTo) return
    setSaving(true)
    await supabase.from('curriculum_items').insert({
      parent_id: addingTo.parentId,
      name: newName.trim(),
      level: addingTo.level,
      display_order: 99,
    })
    setSaving(false)
    setAddingTo(null)
    setNewName('')
    load()
  }

  function startAdd(parentId: string | null, level: number) {
    setAddingTo({ parentId, level })
    setNewName('')
    setEditingId(null)
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
          <h1 className="text-2xl font-bold text-gray-800">カリキュラム管理</h1>
          <p className="text-gray-500 text-sm mt-0.5">レッスン計画・評価で使用する大・中・小項目を管理します</p>
        </div>
        <button
          onClick={() => startAdd(null, 1)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-sm transition-colors"
        >
          <Plus size={16} /> 大項目を追加
        </button>
      </div>

      {/* 凡例 */}
      <div className="flex gap-3 mb-5 text-xs text-gray-500">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-indigo-100 inline-block" />大項目</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-gray-100 inline-block" />中項目</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-white border border-gray-200 inline-block" />小項目</span>
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

      <div className="space-y-3">
        {tree.map(root => (
          <div key={root.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
            {/* 大項目 */}
            <div className="flex items-center gap-2 px-4 py-3.5 bg-indigo-50 border-b border-indigo-100">
              <button
                onClick={() => toggleExpand(root.id)}
                className="text-indigo-500 hover:text-indigo-700 flex-shrink-0"
              >
                {expanded.has(root.id) ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              </button>
              {editingId === root.id ? (
                <div className="flex-1 flex items-center gap-2">
                  <input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(root.id); if (e.key === 'Escape') setEditingId(null) }}
                    className="flex-1 border border-indigo-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                    autoFocus
                  />
                  <button onClick={() => saveEdit(root.id)} className="text-indigo-600 hover:text-indigo-800 p-1"><Check size={16} /></button>
                  <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600 p-1"><X size={16} /></button>
                </div>
              ) : (
                <>
                  <span className="flex-1 font-semibold text-indigo-800">{root.name}</span>
                  <span className="text-xs text-indigo-400 mr-2">{root.children.length}項目</span>
                  <button onClick={() => startEdit(root)} className="text-indigo-400 hover:text-indigo-700 p-1 rounded hover:bg-indigo-100 transition-colors"><Pencil size={14} /></button>
                  <button onClick={() => deleteItem(root.id)} className="text-indigo-300 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors"><Trash2 size={14} /></button>
                </>
              )}
            </div>

            {expanded.has(root.id) && (
              <div>
                {root.children.map(mid => (
                  <div key={mid.id}>
                    {/* 中項目 */}
                    <div className="flex items-center gap-2 pl-8 pr-4 py-3 bg-gray-50 border-b border-gray-100">
                      <button
                        onClick={() => toggleExpand(mid.id)}
                        className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                      >
                        {expanded.has(mid.id) ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                      </button>
                      {editingId === mid.id ? (
                        <div className="flex-1 flex items-center gap-2">
                          <input
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') saveEdit(mid.id); if (e.key === 'Escape') setEditingId(null) }}
                            className="flex-1 border border-indigo-300 rounded-lg px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            autoFocus
                          />
                          <button onClick={() => saveEdit(mid.id)} className="text-indigo-600 p-1"><Check size={14} /></button>
                          <button onClick={() => setEditingId(null)} className="text-gray-400 p-1"><X size={14} /></button>
                        </div>
                      ) : (
                        <>
                          <span className="flex-1 text-sm font-medium text-gray-700">{mid.name}</span>
                          <span className="text-xs text-gray-400 mr-2">{(mid.children ?? []).length}項目</span>
                          <button onClick={() => startEdit(mid)} className="text-gray-400 hover:text-indigo-600 p-1 rounded hover:bg-indigo-50 transition-colors"><Pencil size={13} /></button>
                          <button onClick={() => deleteItem(mid.id)} className="text-gray-300 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors"><Trash2 size={13} /></button>
                        </>
                      )}
                    </div>

                    {/* 小項目 */}
                    {expanded.has(mid.id) && (
                      <div>
                        {(mid.children ?? []).map(small => (
                          <div key={small.id} className="flex items-center gap-2 pl-16 pr-4 py-2.5 border-b border-gray-50 hover:bg-gray-50 transition-colors">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
                            {editingId === small.id ? (
                              <div className="flex-1 flex items-center gap-2">
                                <input
                                  value={editName}
                                  onChange={e => setEditName(e.target.value)}
                                  onKeyDown={e => { if (e.key === 'Enter') saveEdit(small.id); if (e.key === 'Escape') setEditingId(null) }}
                                  className="flex-1 border border-indigo-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                  autoFocus
                                />
                                <button onClick={() => saveEdit(small.id)} className="text-indigo-600 p-1"><Check size={13} /></button>
                                <button onClick={() => setEditingId(null)} className="text-gray-400 p-1"><X size={13} /></button>
                              </div>
                            ) : (
                              <>
                                <span className="flex-1 text-sm text-gray-600">{small.name}</span>
                                <button onClick={() => startEdit(small)} className="text-gray-300 hover:text-indigo-600 p-1 rounded hover:bg-indigo-50 transition-colors"><Pencil size={12} /></button>
                                <button onClick={() => deleteItem(small.id)} className="text-gray-300 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors"><Trash2 size={12} /></button>
                              </>
                            )}
                          </div>
                        ))}
                        {/* 小項目追加 */}
                        {addingTo?.parentId === mid.id && addingTo.level === 3 ? (
                          <div className="flex items-center gap-2 pl-16 pr-4 py-2.5 border-b border-gray-50 bg-indigo-50/50">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-300 flex-shrink-0" />
                            <input
                              value={newName}
                              onChange={e => setNewName(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && addItem()}
                              placeholder="小項目名を入力"
                              className="flex-1 border border-indigo-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              autoFocus
                            />
                            <button onClick={addItem} disabled={saving} className="text-indigo-600 hover:text-indigo-800 p-1"><Check size={13} /></button>
                            <button onClick={() => setAddingTo(null)} className="text-gray-400 p-1"><X size={13} /></button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startAdd(mid.id, 3)}
                            className="flex items-center gap-1.5 pl-16 pr-4 py-2 text-xs text-gray-400 hover:text-indigo-600 transition-colors w-full"
                          >
                            <Plus size={12} /> 小項目を追加
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {/* 中項目追加 */}
                {addingTo?.parentId === root.id && addingTo.level === 2 ? (
                  <div className="flex items-center gap-2 pl-8 pr-4 py-3 border-b border-gray-100 bg-indigo-50/50">
                    <span className="w-2 h-2 rounded-sm bg-indigo-200 flex-shrink-0" />
                    <input
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addItem()}
                      placeholder="中項目名を入力"
                      className="flex-1 border border-indigo-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      autoFocus
                    />
                    <button onClick={addItem} disabled={saving} className="text-indigo-600 hover:text-indigo-800 p-1"><Check size={15} /></button>
                    <button onClick={() => setAddingTo(null)} className="text-gray-400 p-1"><X size={15} /></button>
                  </div>
                ) : (
                  <button
                    onClick={() => startAdd(root.id, 2)}
                    className="flex items-center gap-1.5 pl-8 pr-4 py-3 text-xs text-gray-400 hover:text-indigo-600 transition-colors w-full"
                  >
                    <Plus size={13} /> 中項目を追加
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
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
