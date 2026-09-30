'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { LessonType } from '@/types/database'
import { Plus, Pencil, Trash2, Check, X, Loader2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'

export default function LessonTypesPage() {
  const supabase = createClient()
  const [types, setTypes] = useState<LessonType[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', duration_minutes: '', price: '' })

  const [adding, setAdding] = useState(false)
  const [newForm, setNewForm] = useState({ name: '', duration_minutes: '60', price: '0' })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('lesson_types').select('*').order('name')
    setTypes(data ?? [])
    setLoading(false)
  }

  function startEdit(t: LessonType) {
    setEditingId(t.id)
    setEditForm({ name: t.name, duration_minutes: String(t.duration_minutes), price: String(t.price) })
  }

  async function saveEdit(id: string) {
    if (!editForm.name.trim()) return
    setSaving(true)
    const { error } = await supabase.from('lesson_types').update({
      name: editForm.name.trim(),
      duration_minutes: Number(editForm.duration_minutes) || 0,
      price: Number(editForm.price) || 0,
    }).eq('id', id)
    setSaving(false)
    if (error) { alert(`保存に失敗しました: ${error.message}`); return }
    setEditingId(null)
    load()
  }

  async function addType() {
    if (!newForm.name.trim()) return
    setSaving(true)
    const { error } = await supabase.from('lesson_types').insert([{
      name: newForm.name.trim(),
      duration_minutes: Number(newForm.duration_minutes) || 0,
      price: Number(newForm.price) || 0,
    }])
    setSaving(false)
    if (error) { alert(`追加に失敗しました: ${error.message}`); return }
    setAdding(false)
    setNewForm({ name: '', duration_minutes: '60', price: '0' })
    load()
  }

  async function deleteType(id: string) {
    if (!window.confirm('このレッスン種別を削除しますか？（この種別を使っているレッスンは種別未設定になります）')) return
    setSaving(true)
    await supabase.from('lessons').update({ lesson_type_id: null }).eq('lesson_type_id', id)
    const { error } = await supabase.from('lesson_types').delete().eq('id', id)
    setSaving(false)
    if (error) { alert(`削除に失敗しました: ${error.message}`); return }
    load()
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/lessons" className="text-gray-400 hover:text-gray-600"><ArrowLeft size={20} /></Link>
        <h1 className="text-2xl font-bold text-gray-800">レッスン種別の管理</h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-5">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-gray-400">
            <Loader2 size={20} className="animate-spin mr-2" /> 読み込み中...
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {types.map(t => (
              <li key={t.id} className="py-3">
                {editingId === t.id ? (
                  <div className="grid grid-cols-[1fr_100px_120px_auto] gap-2 items-center">
                    <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="種別名" />
                    <input type="number" min="0" value={editForm.duration_minutes} onChange={e => setEditForm(f => ({ ...f, duration_minutes: e.target.value }))} className={inputCls} placeholder="分" />
                    <input type="number" min="0" value={editForm.price} onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))} className={inputCls} placeholder="円" />
                    <div className="flex items-center gap-1">
                      <button onClick={() => saveEdit(t.id)} disabled={saving} className="p-1.5 text-green-600 hover:bg-green-50 rounded disabled:opacity-50"><Check size={16} /></button>
                      <button onClick={() => setEditingId(null)} className="p-1.5 text-gray-400 hover:bg-gray-50 rounded"><X size={16} /></button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-gray-800">{t.name}</span>
                      <span className="ml-2 text-xs text-gray-400">{t.duration_minutes}分 / ¥{t.price.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => startEdit(t)} className="p-1.5 text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 rounded"><Pencil size={14} /></button>
                      <button onClick={() => deleteType(t.id)} disabled={saving} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded disabled:opacity-50"><Trash2 size={14} /></button>
                    </div>
                  </div>
                )}
              </li>
            ))}
            {types.length === 0 && (
              <li className="py-6 text-center text-gray-400 text-sm">レッスン種別がまだありません</li>
            )}
          </ul>
        )}

        {adding ? (
          <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-[1fr_100px_120px_auto] gap-2 items-center">
            <input autoFocus value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="種別名（例: タップダンスレッスン）" />
            <input type="number" min="0" value={newForm.duration_minutes} onChange={e => setNewForm(f => ({ ...f, duration_minutes: e.target.value }))} className={inputCls} placeholder="分" />
            <input type="number" min="0" value={newForm.price} onChange={e => setNewForm(f => ({ ...f, price: e.target.value }))} className={inputCls} placeholder="円" />
            <div className="flex items-center gap-1">
              <button onClick={addType} disabled={saving} className="p-1.5 text-green-600 hover:bg-green-50 rounded disabled:opacity-50"><Check size={16} /></button>
              <button onClick={() => setAdding(false)} className="p-1.5 text-gray-400 hover:bg-gray-50 rounded"><X size={16} /></button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className="mt-4 flex items-center gap-1.5 text-indigo-600 hover:text-indigo-700 text-sm font-medium">
            <Plus size={16} /> 種別を追加
          </button>
        )}
      </div>
    </div>
  )
}
