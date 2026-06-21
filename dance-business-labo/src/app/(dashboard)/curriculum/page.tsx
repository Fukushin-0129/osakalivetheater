'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CurriculumItem, MediaItem } from '@/types/database'
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Check, X, Loader2, GripVertical, BookOpen, Image, Video, Link, FileText, ExternalLink } from 'lucide-react'

type TreeItem = CurriculumItem & { children: TreeItem[] }

function isYouTube(url: string) {
  return /youtube\.com|youtu\.be/.test(url)
}

function getYouTubeId(url: string) {
  const m = url.match(/(?:v=|youtu\.be\/)([^&?/]+)/)
  return m ? m[1] : null
}

function isImage(url: string) {
  return /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(url)
}

function isVideo(url: string) {
  return /\.(mp4|webm|ogg)(\?|$)/i.test(url)
}

function detectType(url: string): MediaItem['type'] {
  if (isYouTube(url) || isVideo(url)) return 'video'
  if (isImage(url)) return 'image'
  return 'link'
}

// ── メディア表示コンポーネント ──
function MediaPreview({ item }: { item: MediaItem }) {
  if (item.type === 'video' && isYouTube(item.url)) {
    const vid = getYouTubeId(item.url)
    return (
      <div className="rounded-lg overflow-hidden bg-black aspect-video">
        <iframe
          src={`https://www.youtube.com/embed/${vid}`}
          className="w-full h-full"
          allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        />
      </div>
    )
  }
  if (item.type === 'video') {
    return (
      <div className="rounded-lg overflow-hidden bg-black aspect-video">
        <video src={item.url} controls className="w-full h-full" />
      </div>
    )
  }
  if (item.type === 'image') {
    return (
      <a href={item.url} target="_blank" rel="noopener noreferrer">
        <img src={item.url} alt={item.label ?? ''} className="rounded-lg max-h-64 object-contain bg-gray-100 w-full" />
      </a>
    )
  }
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 text-sm underline"
    >
      <ExternalLink size={14} />
      {item.label || item.url}
    </a>
  )
}

// ── 小項目の詳細パネル ──
function SmallItemDetail({ item, onSaved }: { item: TreeItem; onSaved: () => void }) {
  const supabase = createClient()
  const [description, setDescription] = useState(item.description ?? '')
  const [mediaItems, setMediaItems] = useState<MediaItem[]>(item.media_items ?? [])
  const [newUrl, setNewUrl] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  function addMedia() {
    const url = newUrl.trim()
    if (!url) return
    const type = detectType(url)
    const next = [...mediaItems, { type, url, label: newLabel.trim() || undefined }]
    setMediaItems(next)
    setNewUrl('')
    setNewLabel('')
    setDirty(true)
  }

  function removeMedia(idx: number) {
    const next = mediaItems.filter((_, i) => i !== idx)
    setMediaItems(next)
    setDirty(true)
  }

  async function save() {
    setSaving(true)
    const { error } = await supabase
      .from('curriculum_items')
      .update({ description: description || null, media_items: mediaItems })
      .eq('id', item.id)
    setSaving(false)
    if (error) { alert(`保存エラー: ${error.message}`); return }
    setDirty(false)
    onSaved()
  }

  return (
    <div className="pl-14 pr-4 pb-4 pt-2 bg-indigo-50/30 border-b border-gray-100 space-y-3">
      {/* 説明文 */}
      <div>
        <label className="text-xs font-medium text-gray-500 flex items-center gap-1 mb-1">
          <FileText size={11} /> レッスン内容の説明
        </label>
        <textarea
          value={description}
          onChange={e => { setDescription(e.target.value); setDirty(true) }}
          placeholder="このレッスン内容について説明を入力..."
          rows={3}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
        />
      </div>

      {/* メディア一覧 */}
      {mediaItems.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500">追加済みメディア・リンク</p>
          {mediaItems.map((m, idx) => (
            <div key={idx} className="flex gap-2 items-start">
              <div className="flex-1">
                <MediaPreview item={m} />
                {m.label && m.type !== 'link' && (
                  <p className="text-xs text-gray-500 mt-0.5">{m.label}</p>
                )}
              </div>
              <button
                onClick={() => removeMedia(idx)}
                className="flex-shrink-0 text-gray-300 hover:text-red-500 p-1 mt-0.5"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* メディア追加フォーム */}
      <div className="border border-dashed border-gray-300 rounded-lg p-3 space-y-2">
        <p className="text-xs font-medium text-gray-500 flex items-center gap-1">
          <Image size={11} /><Video size={11} /><Link size={11} /> 動画・画像・リンクを追加
        </p>
        <input
          value={newUrl}
          onChange={e => setNewUrl(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) addMedia() }}
          placeholder="URL（YouTube・画像・リンクなど）"
          className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <div className="flex gap-2">
          <input
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            placeholder="ラベル（省略可）"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <button
            onClick={addMedia}
            disabled={!newUrl.trim()}
            className="flex items-center gap-1 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40"
          >
            <Plus size={11} /> 追加
          </button>
        </div>
      </div>

      {/* 保存ボタン */}
      {dirty && (
        <div className="flex justify-end">
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            保存
          </button>
        </div>
      )}
    </div>
  )
}

export default function CurriculumPage() {
  const supabase = createClient()
  const [tree, setTree] = useState<TreeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [detailOpen, setDetailOpen] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [addingTo, setAddingTo] = useState<{ parentId: string | null; level: number } | null>(null)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)

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
    const flat: CurriculumItem[] = (data ?? []).map(d => ({
      ...d,
      media_items: d.media_items ?? [],
    }))
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

  function toggleDetail(id: string) {
    setDetailOpen(prev => {
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

  function onDragStart(e: React.DragEvent, id: string) {
    setDraggedId(id)
    e.dataTransfer.effectAllowed = 'move'
    setTimeout(() => { (e.target as HTMLElement).style.opacity = '0.4' }, 0)
  }

  function onDragEnd(e: React.DragEvent) {
    ;(e.target as HTMLElement).style.opacity = '1'
    setDraggedId(null)
    setDragOverId(null)
    setGrabbedId(null)
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

  function onDragEnter() { dragCounter.current++ }

  async function onDrop(e: React.DragEvent, targetId: string, siblings: TreeItem[]) {
    e.preventDefault()
    const fromId = draggedId
    setDraggedId(null)
    setDragOverId(null)
    setGrabbedId(null)
    dragCounter.current = 0
    if (!fromId || fromId === targetId) return

    const fromIdx = siblings.findIndex(s => s.id === fromId)
    const toIdx = siblings.findIndex(s => s.id === targetId)
    if (fromIdx === -1 || toIdx === -1) return

    const reordered = [...siblings]
    const [moved] = reordered.splice(fromIdx, 1)
    let insertAt = dragBefore ? toIdx : toIdx + 1
    if (fromIdx < toIdx) insertAt--
    reordered.splice(insertAt, 0, moved)

    await Promise.all(
      reordered.map((item, idx) =>
        supabase.from('curriculum_items').update({ display_order: idx + 1 }).eq('id', item.id)
      )
    )
    load(true)
  }

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
            if (e.nativeEvent.isComposing) return
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
          <p className="text-gray-500 text-sm mt-0.5">ダブルクリックで編集 / グリップをドラッグして並び替え</p>
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
            onKeyDown={e => { if (!e.nativeEvent.isComposing && e.key === 'Enter') addItem() }}
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
          const isGrabbed = grabbedId === root.id
          const isOver = dragOverId === root.id
          return (
            <div
              key={root.id}
              draggable={isGrabbed}
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
                <span
                  className="cursor-grab active:cursor-grabbing text-indigo-300 hover:text-indigo-500 flex-shrink-0 touch-none"
                  onMouseDown={() => setGrabbedId(root.id)}
                >
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
                    const isMidGrabbed = grabbedId === mid.id
                    const isMidOver = dragOverId === mid.id
                    return (
                      <div key={mid.id}>
                        <div
                          draggable={isMidGrabbed}
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
                          <span
                            className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 flex-shrink-0"
                            onMouseDown={() => setGrabbedId(mid.id)}
                          >
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
                              const isSmallGrabbed = grabbedId === small.id
                              const isSmallOver = dragOverId === small.id
                              const hasDetail = !!(small.description || (small.media_items ?? []).length > 0)
                              const isDetailOpen = detailOpen.has(small.id)
                              return (
                                <div
                                  key={small.id}
                                  draggable={isSmallGrabbed}
                                  onDragStart={e => { e.stopPropagation(); onDragStart(e, small.id) }}
                                  onDragEnd={e => { e.stopPropagation(); onDragEnd(e) }}
                                  onDragOver={e => { e.stopPropagation(); onDragOver(e, small.id) }}
                                  onDragEnter={e => { e.stopPropagation(); onDragEnter() }}
                                  onDragLeave={e => { e.stopPropagation(); onDragLeave() }}
                                  onDrop={e => { e.stopPropagation(); onDrop(e, small.id, (mid.children ?? []) as TreeItem[]) }}
                                  className={`border-b border-gray-50 transition-all ${
                                    isSmallOver ? (dragBefore ? 'border-t-2 border-indigo-300' : 'border-b-2 border-indigo-300') : ''
                                  } ${draggedId === small.id ? 'opacity-40' : ''}`}
                                >
                                  <div className="flex items-center gap-2 pl-14 pr-4 py-2 hover:bg-gray-50">
                                    <span
                                      className="cursor-grab active:cursor-grabbing text-gray-200 hover:text-gray-400 flex-shrink-0"
                                      onMouseDown={() => setGrabbedId(small.id)}
                                    >
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
                                        {/* 詳細トグルボタン */}
                                        <button
                                          onClick={() => toggleDetail(small.id)}
                                          className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors ${
                                            isDetailOpen
                                              ? 'bg-indigo-100 text-indigo-700'
                                              : hasDetail
                                                ? 'text-indigo-400 hover:text-indigo-700 hover:bg-indigo-50'
                                                : 'text-gray-300 hover:text-indigo-500 hover:bg-indigo-50'
                                          }`}
                                          title="説明・動画・リンクを編集"
                                        >
                                          <FileText size={11} />
                                          {hasDetail ? '詳細' : '追加'}
                                        </button>
                                        <button onClick={() => startEdit(small)} className="text-gray-200 hover:text-indigo-600 p-1 rounded hover:bg-indigo-50 transition-colors"><Pencil size={11} /></button>
                                        <button onClick={() => deleteItem(small.id)} className="text-gray-200 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors"><Trash2 size={11} /></button>
                                      </>
                                    )}
                                  </div>
                                  {/* 詳細パネル */}
                                  {isDetailOpen && (
                                    <SmallItemDetail
                                      item={small}
                                      onSaved={() => load(true)}
                                    />
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
                                  onKeyDown={e => { if (!e.nativeEvent.isComposing && e.key === 'Enter') addItem() }}
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
                        onKeyDown={e => { if (!e.nativeEvent.isComposing && e.key === 'Enter') addItem() }}
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
