'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CurriculumItem } from '@/types/database'
import { Plus, Pencil, Trash2, Check, X, Loader2, GripVertical, BookOpen, Video, ExternalLink, Brain } from 'lucide-react'

type TreeItem = CurriculumItem & { children: TreeItem[] }

function getYouTubeId(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtube.com')) return u.searchParams.get('v')
    if (u.hostname === 'youtu.be') return u.pathname.slice(1)
  } catch {}
  return null
}

function VideoThumbnail({ url }: { url: string }) {
  const ytId = getYouTubeId(url)
  if (!ytId) return null
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 group relative">
      <img src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`} alt="動画サムネイル"
        className="w-16 h-11 object-cover rounded border border-gray-200 group-hover:opacity-80 transition-opacity" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-black/60 rounded-full p-1 group-hover:bg-black/80 transition-colors">
          <svg viewBox="0 0 24 24" className="w-3 h-3 fill-white"><path d="M8 5v14l11-7z"/></svg>
        </div>
      </div>
    </a>
  )
}

export default function CurriculumPage() {
  const supabase = createClient()
  const [tree, setTree] = useState<TreeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // 名前編集
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)

  // 追加
  const [addingTo, setAddingTo] = useState<{ parentId: string | null; level: number } | null>(null)
  const [newName, setNewName] = useState('')

  // 動画URL
  const [videoEditId, setVideoEditId] = useState<string | null>(null)
  const [videoEditUrl, setVideoEditUrl] = useState('')

  // 脳への影響・進め方（中項目のみ）
  const [brainEditId, setBrainEditId] = useState<string | null>(null)
  const [brainEditEffects, setBrainEditEffects] = useState('')
  const [brainEditNotes, setBrainEditNotes] = useState('')

  // ドラッグ
  const [grabbedId, setGrabbedId] = useState<string | null>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [dragBefore, setDragBefore] = useState(false)
  const dragCounter = useRef(0)

  useEffect(() => { load() }, [])
  useEffect(() => {
    const onMouseUp = () => setGrabbedId(null)
    window.addEventListener('mouseup', onMouseUp)
    return () => window.removeEventListener('mouseup', onMouseUp)
  }, [])

  async function load(silent = false) {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    const { data } = await supabase.from('curriculum_items').select('*').order('display_order').order('created_at')
    const flat: CurriculumItem[] = data ?? []
    const roots: TreeItem[] = flat.filter(i => i.parent_id === null).map(i => ({ ...i, children: [] }))
    for (const root of roots) {
      root.children = flat.filter(i => i.parent_id === root.id).map(i => ({
        ...i, children: flat.filter(j => j.parent_id === i.id).map(j => ({ ...j, children: [] }))
      }))
    }
    setTree(roots)
    setLoading(false)
    setRefreshing(false)
  }

  async function saveEdit(id: string) {
    if (!editName.trim()) { setEditingId(null); return }
    setSaving(true)
    await supabase.from('curriculum_items').update({ name: editName.trim() }).eq('id', id)
    setSaving(false)
    setEditingId(null)
    load(true)
  }

  async function deleteItem(id: string) {
    if (!confirm('この項目と配下の項目をすべて削除しますか？')) return
    await supabase.from('curriculum_items').delete().eq('id', id)
    load(true)
  }

  async function addItem() {
    const name = newName.trim()
    if (!name || !addingTo) return
    setSaving(true)
    await supabase.from('curriculum_items').insert({ parent_id: addingTo.parentId, name, level: addingTo.level, display_order: 99 })
    setSaving(false)
    setAddingTo(null)
    setNewName('')
    load(true)
  }

  async function saveVideoUrl(id: string) {
    setSaving(true)
    await supabase.from('curriculum_items').update({ video_url: videoEditUrl.trim() || null }).eq('id', id)
    setSaving(false)
    setVideoEditId(null)
    load(true)
  }

  async function saveBrainEdit(id: string) {
    setSaving(true)
    await supabase.from('curriculum_items').update({ brain_effects: brainEditEffects.trim() || null, teaching_notes: brainEditNotes.trim() || null }).eq('id', id)
    setSaving(false)
    setBrainEditId(null)
    load(true)
  }

  function openBrainEdit(item: CurriculumItem) {
    setBrainEditId(item.id)
    setBrainEditEffects(item.brain_effects ?? '')
    setBrainEditNotes(item.teaching_notes ?? '')
  }

  // ドラッグ＆ドロップ
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
  async function onDrop(e: React.DragEvent, targetId: string, siblings: TreeItem[]) {
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
    load(true)
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20 text-gray-400">
      <Loader2 size={24} className="animate-spin mr-2" /> 読み込み中...
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-800">カリキュラム管理</h1>
            {refreshing && <Loader2 size={16} className="animate-spin text-indigo-400" />}
          </div>
          <p className="text-gray-500 text-sm mt-0.5">ダブルクリックで編集 / グリップをドラッグして並び替え</p>
        </div>
        <button onClick={() => { setAddingTo({ parentId: null, level: 1 }); setNewName('') }}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-sm transition-colors">
          <Plus size={16} /> 大項目を追加
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {/* 大項目追加フォーム */}
        {addingTo?.level === 1 && addingTo.parentId === null && (
          <div className="flex items-center gap-3 px-4 py-3 border-b border-indigo-100 bg-indigo-50">
            <span className="text-xs font-semibold text-indigo-600 w-10 flex-shrink-0">大項目</span>
            <input value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (!e.nativeEvent.isComposing && e.key === 'Enter') addItem() }}
              placeholder="大項目名を入力" autoFocus
              className="flex-1 border border-indigo-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <button onClick={addItem} disabled={saving || !newName.trim()}
              className="flex items-center gap-1 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} 追加
            </button>
            <button onClick={() => setAddingTo(null)} className="text-gray-400 hover:text-gray-600 p-1"><X size={16} /></button>
          </div>
        )}

        {tree.map((root, rootIdx) => {
          const isGrabbed = grabbedId === root.id
          const isOver = dragOverId === root.id
          return (
            <div key={root.id}
              draggable={isGrabbed}
              onDragStart={e => onDragStart(e, root.id)} onDragEnd={onDragEnd}
              onDragOver={e => onDragOver(e, root.id)} onDragEnter={onDragEnter} onDragLeave={onDragLeave}
              onDrop={e => onDrop(e, root.id, tree)}
              className={`border-b border-gray-100 last:border-0 ${isOver ? (dragBefore ? 'border-t-2 border-indigo-500' : 'border-b-2 border-indigo-500') : ''} ${draggedId === root.id ? 'opacity-40' : ''}`}>

              {/* 大項目行 */}
              <div className="flex items-center gap-1 px-3 py-2.5 bg-indigo-50/80">
                <span className="cursor-grab active:cursor-grabbing text-indigo-300 hover:text-indigo-500 flex-shrink-0 touch-none"
                  onMouseDown={() => setGrabbedId(root.id)}><GripVertical size={14} /></span>
                {editingId === root.id ? (
                  <div className="flex-1 flex items-center gap-2">
                    <input value={editName} onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => { if (e.nativeEvent.isComposing) return; if (e.key === 'Enter') saveEdit(root.id); if (e.key === 'Escape') setEditingId(null) }}
                      className="flex-1 border border-indigo-300 rounded-lg px-2 py-1 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500" autoFocus />
                    <button onClick={() => saveEdit(root.id)} className="text-indigo-600 hover:text-indigo-800 p-1">
                      {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                    </button>
                    <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600 p-1"><X size={13} /></button>
                  </div>
                ) : (
                  <>
                    <span className="flex-1 font-semibold text-indigo-800 text-sm cursor-pointer select-none"
                      onDoubleClick={() => { setEditingId(root.id); setEditName(root.name) }}
                      title="ダブルクリックで編集">{root.name}</span>
                    {root.video_url && <VideoThumbnail url={root.video_url} />}
                    {root.video_url && <a href={root.video_url} target="_blank" rel="noopener noreferrer"
                      className="text-indigo-400 hover:text-indigo-600 p-1 rounded hover:bg-indigo-100" title="動画を開く"><ExternalLink size={12} /></a>}
                    <button onClick={() => { setVideoEditId(root.id); setVideoEditUrl(root.video_url ?? '') }}
                      className={`p-1 rounded hover:bg-indigo-100 transition-colors ${root.video_url ? 'text-indigo-500' : 'text-indigo-200 hover:text-indigo-500'}`} title="動画リンク"><Video size={12} /></button>
                    <button onClick={() => { setEditingId(root.id); setEditName(root.name) }}
                      className="text-indigo-300 hover:text-indigo-600 p-1 rounded hover:bg-indigo-100"><Pencil size={12} /></button>
                    <button onClick={() => deleteItem(root.id)}
                      className="text-indigo-200 hover:text-red-500 p-1 rounded hover:bg-red-50"><Trash2 size={12} /></button>
                  </>
                )}
              </div>

              {/* 中項目・小項目（常時表示） */}
              {root.children.map(mid => {
                const isMidGrabbed = grabbedId === mid.id
                const isMidOver = dragOverId === mid.id
                const brainEditing = brainEditId === mid.id
                return (
                  <div key={mid.id}
                    draggable={isMidGrabbed}
                    onDragStart={e => { e.stopPropagation(); onDragStart(e, mid.id) }}
                    onDragEnd={e => { e.stopPropagation(); onDragEnd(e) }}
                    onDragOver={e => { e.stopPropagation(); onDragOver(e, mid.id) }}
                    onDragEnter={e => { e.stopPropagation(); onDragEnter() }}
                    onDragLeave={e => { e.stopPropagation(); onDragLeave() }}
                    onDrop={e => { e.stopPropagation(); onDrop(e, mid.id, root.children) }}
                    className={`border-b border-gray-100 ${isMidOver ? (dragBefore ? 'border-t-2 border-indigo-400' : 'border-b-2 border-indigo-400') : ''} ${draggedId === mid.id ? 'opacity-40' : ''}`}>

                    {/* 中項目：左（名前）＋ 右（脳への影響・進め方）の2カラム */}
                    <div className="flex gap-0 pl-6 pr-3 bg-gray-50/40 hover:bg-gray-50/80 transition-colors">
                      {/* 左カラム：項目名＋操作ボタン */}
                      <div className="flex items-start gap-1 py-3 w-48 flex-shrink-0 border-r border-gray-100">
                        <span className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 flex-shrink-0 mt-0.5"
                          onMouseDown={() => setGrabbedId(mid.id)}><GripVertical size={13} /></span>
                        {editingId === mid.id ? (
                          <div className="flex-1 flex flex-col gap-1.5">
                            <input value={editName} onChange={e => setEditName(e.target.value)}
                              onKeyDown={e => { if (e.nativeEvent.isComposing) return; if (e.key === 'Enter') saveEdit(mid.id); if (e.key === 'Escape') setEditingId(null) }}
                              className="w-full border border-indigo-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" autoFocus />
                            <div className="flex gap-1">
                              <button onClick={() => saveEdit(mid.id)} className="text-indigo-600 hover:text-indigo-800 p-1">
                                {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                              </button>
                              <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600 p-1"><X size={12} /></button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex-1 min-w-0">
                            <span className="block text-sm font-medium text-gray-700 cursor-pointer select-none leading-snug"
                              onDoubleClick={() => { setEditingId(mid.id); setEditName(mid.name) }}
                              title="ダブルクリックで編集">{mid.name}</span>
                            <div className="flex items-center gap-0.5 mt-1">
                              {mid.video_url && <a href={mid.video_url} target="_blank" rel="noopener noreferrer"
                                className="text-indigo-400 hover:text-indigo-600 p-0.5 rounded hover:bg-indigo-50"><ExternalLink size={10} /></a>}
                              <button onClick={() => { setVideoEditId(mid.id); setVideoEditUrl(mid.video_url ?? '') }}
                                className={`p-0.5 rounded hover:bg-indigo-50 ${mid.video_url ? 'text-indigo-400' : 'text-gray-200 hover:text-indigo-500'}`}><Video size={10} /></button>
                              <button onClick={() => { setEditingId(mid.id); setEditName(mid.name) }}
                                className="text-gray-300 hover:text-indigo-600 p-0.5 rounded hover:bg-indigo-50"><Pencil size={10} /></button>
                              <button onClick={() => deleteItem(mid.id)}
                                className="text-gray-200 hover:text-red-500 p-0.5 rounded hover:bg-red-50"><Trash2 size={10} /></button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 右カラム：脳への影響・進め方（常時表示） */}
                      <div className="flex-1 min-w-0 py-2.5 pl-4">
                        {brainEditing ? (
                          <div className="space-y-2.5">
                            <div>
                              <label className="block text-xs font-semibold text-emerald-700 mb-1">脳への影響</label>
                              <textarea value={brainEditEffects} onChange={e => setBrainEditEffects(e.target.value)} rows={4}
                                className="w-full border border-emerald-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-emerald-700 mb-1">進め方の提案</label>
                              <textarea value={brainEditNotes} onChange={e => setBrainEditNotes(e.target.value)} rows={4}
                                className="w-full border border-emerald-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none" />
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => setBrainEditId(null)}
                                className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">キャンセル</button>
                              <button onClick={() => saveBrainEdit(mid.id)} disabled={saving}
                                className="flex items-center gap-1 text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                                {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} 保存
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-3 items-start">
                            <div className="flex-1 min-w-0 space-y-1.5">
                              {mid.brain_effects ? (
                                <>
                                  <div>
                                    <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide">脳への影響</span>
                                    <p className="text-xs text-gray-600 leading-relaxed mt-0.5">{mid.brain_effects}</p>
                                  </div>
                                  {mid.teaching_notes && (
                                    <div>
                                      <span className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wide">進め方の提案</span>
                                      <p className="text-xs text-gray-600 leading-relaxed mt-0.5">{mid.teaching_notes}</p>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <p className="text-xs text-gray-300 italic">未入力</p>
                              )}
                            </div>
                            <button onClick={() => openBrainEdit(mid)}
                              className="flex-shrink-0 text-gray-300 hover:text-emerald-600 p-1 rounded hover:bg-emerald-50 transition-colors mt-0.5"
                              title="脳への影響・進め方を編集">
                              <Pencil size={11} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 小項目 */}
                    {(mid.children ?? []).map(small => {
                      const isSmallGrabbed = grabbedId === small.id
                      const isSmallOver = dragOverId === small.id
                      const smallBrainEditing = brainEditId === small.id
                      return (
                        <div key={small.id} className="border-b border-gray-50">
                          <div
                            draggable={isSmallGrabbed}
                            onDragStart={e => { e.stopPropagation(); onDragStart(e, small.id) }}
                            onDragEnd={e => { e.stopPropagation(); onDragEnd(e) }}
                            onDragOver={e => { e.stopPropagation(); onDragOver(e, small.id) }}
                            onDragEnter={e => { e.stopPropagation(); onDragEnter() }}
                            onDragLeave={e => { e.stopPropagation(); onDragLeave() }}
                            onDrop={e => { e.stopPropagation(); onDrop(e, small.id, mid.children as TreeItem[]) }}
                            className={`flex items-center gap-1 pl-12 pr-3 py-1.5 hover:bg-gray-50/60 transition-colors ${isSmallOver ? (dragBefore ? 'border-t-2 border-indigo-300' : 'border-b-2 border-indigo-300') : ''} ${draggedId === small.id ? 'opacity-40' : ''}`}>
                            <span className="cursor-grab active:cursor-grabbing text-gray-200 hover:text-gray-400 flex-shrink-0"
                              onMouseDown={() => setGrabbedId(small.id)}><GripVertical size={12} /></span>
                            {editingId === small.id ? (
                              <div className="flex-1 flex items-center gap-2">
                                <input value={editName} onChange={e => setEditName(e.target.value)}
                                  onKeyDown={e => { if (e.nativeEvent.isComposing) return; if (e.key === 'Enter') saveEdit(small.id); if (e.key === 'Escape') setEditingId(null) }}
                                  className="flex-1 border border-indigo-300 rounded-lg px-2 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500" autoFocus />
                                <button onClick={() => saveEdit(small.id)} className="text-indigo-600 p-1">
                                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                                </button>
                                <button onClick={() => setEditingId(null)} className="text-gray-400 p-1"><X size={12} /></button>
                              </div>
                            ) : (
                              <>
                                <span className="flex-1 text-sm text-gray-600 cursor-pointer select-none"
                                  onDoubleClick={() => { setEditingId(small.id); setEditName(small.name) }}
                                  title="ダブルクリックで編集">{small.name}</span>
                                {small.teaching_notes && (
                                  <span className="text-[9px] text-indigo-400 bg-indigo-50 px-1.5 py-0.5 rounded-full flex-shrink-0">指導ノート有</span>
                                )}
                                {small.video_url && <VideoThumbnail url={small.video_url} />}
                                {small.video_url && <a href={small.video_url} target="_blank" rel="noopener noreferrer"
                                  className="text-indigo-400 hover:text-indigo-600 p-1 rounded hover:bg-indigo-50"><ExternalLink size={10} /></a>}
                                <button onClick={() => { setVideoEditId(small.id); setVideoEditUrl(small.video_url ?? '') }}
                                  className={`p-1 rounded hover:bg-indigo-50 ${small.video_url ? 'text-indigo-400' : 'text-gray-200 hover:text-indigo-500'}`}><Video size={10} /></button>
                                <button onClick={() => openBrainEdit(small)}
                                  className={`p-1 rounded hover:bg-emerald-50 ${(small.brain_effects || small.teaching_notes) ? 'text-emerald-500' : 'text-gray-200 hover:text-emerald-500'}`}
                                  title="脳への影響・指導ノートを編集"><Brain size={10} /></button>
                                <button onClick={() => { setEditingId(small.id); setEditName(small.name) }}
                                  className="text-gray-200 hover:text-indigo-600 p-1 rounded hover:bg-indigo-50"><Pencil size={10} /></button>
                                <button onClick={() => deleteItem(small.id)}
                                  className="text-gray-200 hover:text-red-500 p-1 rounded hover:bg-red-50"><Trash2 size={10} /></button>
                              </>
                            )}
                          </div>
                          {smallBrainEditing ? (
                            <div className="pl-12 pr-3 pb-2.5 space-y-2">
                              <div>
                                <label className="block text-xs font-semibold text-emerald-700 mb-1">脳への影響</label>
                                <textarea value={brainEditEffects} onChange={e => setBrainEditEffects(e.target.value)} rows={3}
                                  className="w-full border border-emerald-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none" />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-indigo-700 mb-1">指導ノート（進め方の提案）</label>
                                <textarea value={brainEditNotes} onChange={e => setBrainEditNotes(e.target.value)} rows={3}
                                  className="w-full border border-indigo-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none" />
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => setBrainEditId(null)}
                                  className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">キャンセル</button>
                                <button onClick={() => saveBrainEdit(small.id)} disabled={saving}
                                  className="flex items-center gap-1 text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                                  {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} 保存
                                </button>
                              </div>
                            </div>
                          ) : (small.brain_effects || small.teaching_notes) ? (
                            <div className="pl-12 pr-3 pb-2 space-y-1">
                              {small.brain_effects && (
                                <div>
                                  <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide">脳への影響</span>
                                  <p className="text-xs text-gray-600 leading-relaxed mt-0.5">{small.brain_effects}</p>
                                </div>
                              )}
                              {small.teaching_notes && (
                                <div>
                                  <span className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wide">指導ノート</span>
                                  <p className="text-xs text-gray-600 leading-relaxed mt-0.5">{small.teaching_notes}</p>
                                </div>
                              )}
                            </div>
                          ) : null}
                        </div>
                      )
                    })}

                    {/* 小項目追加 */}
                    {addingTo?.parentId === mid.id && addingTo.level === 3 ? (
                      <div className="flex items-center gap-2 pl-12 pr-3 py-2 border-b border-gray-50 bg-indigo-50/40">
                        <input value={newName} onChange={e => setNewName(e.target.value)}
                          onKeyDown={e => { if (!e.nativeEvent.isComposing && e.key === 'Enter') addItem() }}
                          placeholder="小項目名を入力" autoFocus
                          className="flex-1 border border-indigo-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        <button onClick={addItem} disabled={saving} className="text-indigo-600 p-1"><Check size={12} /></button>
                        <button onClick={() => setAddingTo(null)} className="text-gray-400 p-1"><X size={12} /></button>
                      </div>
                    ) : (
                      <button onClick={() => { setAddingTo({ parentId: mid.id, level: 3 }); setNewName('') }}
                        className="flex items-center gap-1 pl-12 pr-3 py-1.5 text-xs text-gray-300 hover:text-indigo-500 transition-colors w-full border-b border-gray-50">
                        <Plus size={10} /> 小項目を追加
                      </button>
                    )}
                  </div>
                )
              })}

              {/* 中項目追加 */}
              {addingTo?.parentId === root.id && addingTo.level === 2 ? (
                <div className="flex items-center gap-2 pl-6 pr-3 py-2.5 border-b border-gray-100 bg-indigo-50/40">
                  <input value={newName} onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => { if (!e.nativeEvent.isComposing && e.key === 'Enter') addItem() }}
                    placeholder="中項目名を入力" autoFocus
                    className="flex-1 border border-indigo-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <button onClick={addItem} disabled={saving} className="text-indigo-600 p-1"><Check size={13} /></button>
                  <button onClick={() => setAddingTo(null)} className="text-gray-400 p-1"><X size={13} /></button>
                </div>
              ) : (
                <button onClick={() => { setAddingTo({ parentId: root.id, level: 2 }); setNewName('') }}
                  className="flex items-center gap-1 pl-6 pr-3 py-2 text-xs text-gray-300 hover:text-indigo-500 transition-colors w-full border-b border-gray-50">
                  <Plus size={11} /> 中項目を追加
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* 動画URLモーダル */}
      {videoEditId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-800 flex items-center gap-2"><Video size={16} /> 動画リンクを設定</h2>
              <button onClick={() => setVideoEditId(null)} className="text-gray-400 hover:text-gray-600 p-1"><X size={20} /></button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <input type="url" value={videoEditUrl} onChange={e => setVideoEditUrl(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveVideoUrl(videoEditId) }}
                placeholder="https://www.youtube.com/watch?v=..." autoFocus
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <p className="text-xs text-gray-400">空欄にして保存するとリンクを削除します</p>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setVideoEditId(null)} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50">キャンセル</button>
              <button onClick={() => saveVideoUrl(videoEditId)} disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white py-2.5 rounded-xl text-sm font-medium">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} 保存
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 bg-indigo-50 rounded-xl p-4 text-xs text-indigo-600 flex items-start gap-2">
        <BookOpen size={14} className="mt-0.5 flex-shrink-0" />
        <span>「レッスン」ページの各レッスン行から「計画・評価」を開いて、カリキュラム項目を選択・評価できます。中項目の <Brain size={11} className="inline" /> ボタンで脳への影響と進め方を確認・編集できます。</span>
      </div>
    </div>
  )
}
