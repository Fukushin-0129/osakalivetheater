'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Lesson } from '@/types/database'
import { Plus, Pencil, Trash2 } from 'lucide-react'

export default function LessonsPage() {
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Lesson | null>(null)
  const [form, setForm] = useState({ title: '', scheduled_at: '', location: '', max_capacity: '20', notes: '' })
  const supabase = createClient()

  async function load() {
    const { data } = await supabase.from('lessons').select('*').order('scheduled_at', { ascending: false })
    setLessons(data ?? [])
  }

  useEffect(() => { load() }, [])

  function openNew() {
    setEditing(null)
    setForm({ title: '', scheduled_at: '', location: '', max_capacity: '20', notes: '' })
    setShowModal(true)
  }

  function openEdit(l: Lesson) {
    setEditing(l)
    setForm({
      title: l.title,
      scheduled_at: l.scheduled_at.slice(0, 16),
      location: l.location ?? '',
      max_capacity: String(l.max_capacity),
      notes: l.notes ?? '',
    })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.title.trim() || !form.scheduled_at) return
    const payload = { ...form, max_capacity: Number(form.max_capacity) }
    if (editing) {
      await supabase.from('lessons').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('lessons').insert(payload)
    }
    setShowModal(false)
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('このレッスンを削除しますか？')) return
    await supabase.from('lessons').delete().eq('id', id)
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">レッスン</h1>
        <button onClick={openNew} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          <Plus size={16} /> 新規作成
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs">
            <tr>
              <th className="text-left px-4 py-3">レッスン名</th>
              <th className="text-left px-4 py-3">日時</th>
              <th className="text-left px-4 py-3 hidden md:table-cell">場所</th>
              <th className="text-left px-4 py-3 hidden md:table-cell">定員</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {lessons.length === 0 && (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400">レッスンがありません</td></tr>
            )}
            {lessons.map(l => (
              <tr key={l.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{l.title}</td>
                <td className="px-4 py-3 text-gray-600">
                  {new Date(l.scheduled_at).toLocaleString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{l.location}</td>
                <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{l.max_capacity}名</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => openEdit(l)} className="text-gray-400 hover:text-indigo-600 mr-2"><Pencil size={15} /></button>
                  <button onClick={() => handleDelete(l.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={15} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">{editing ? 'レッスンを編集' : '新規レッスン作成'}</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600">レッスン名 *</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">日時 *</label>
                <input type="datetime-local" value={form.scheduled_at} onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">場所</label>
                <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">定員</label>
                <input type="number" value={form.max_capacity} onChange={e => setForm(f => ({ ...f, max_capacity: e.target.value }))} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">メモ</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50">キャンセル</button>
              <button onClick={handleSave} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-sm font-medium">保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
