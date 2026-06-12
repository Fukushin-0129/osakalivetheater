'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Student } from '@/types/database'
import { Plus, Search, Pencil, Trash2 } from 'lucide-react'
import Link from 'next/link'

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Student | null>(null)
  const [form, setForm] = useState({ name: '', name_kana: '', email: '', phone: '', birthdate: '', notes: '' })
  const supabase = createClient()

  async function load() {
    const { data } = await supabase.from('students').select('*').order('name_kana')
    setStudents(data ?? [])
  }

  useEffect(() => { load() }, [])

  function openNew() {
    setEditing(null)
    setForm({ name: '', name_kana: '', email: '', phone: '', birthdate: '', notes: '' })
    setShowModal(true)
  }

  function openEdit(s: Student) {
    setEditing(s)
    setForm({ name: s.name, name_kana: s.name_kana ?? '', email: s.email ?? '', phone: s.phone ?? '', birthdate: s.birthdate ?? '', notes: s.notes ?? '' })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.name.trim()) return
    if (editing) {
      await supabase.from('students').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editing.id)
    } else {
      await supabase.from('students').insert({ ...form })
    }
    setShowModal(false)
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('この生徒を削除しますか？')) return
    await supabase.from('students').delete().eq('id', id)
    load()
  }

  const filtered = students.filter(s =>
    s.name.includes(search) || (s.name_kana ?? '').includes(search) || (s.email ?? '').includes(search)
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">生徒管理</h1>
        <button onClick={openNew} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          <Plus size={16} /> 新規追加
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="名前・よみがな・メールで検索"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs">
            <tr>
              <th className="text-left px-4 py-3">名前</th>
              <th className="text-left px-4 py-3 hidden md:table-cell">よみがな</th>
              <th className="text-left px-4 py-3 hidden md:table-cell">電話番号</th>
              <th className="text-left px-4 py-3 hidden lg:table-cell">メール</th>
              <th className="text-left px-4 py-3">状態</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400">生徒が見つかりません</td></tr>
            )}
            {filtered.map(s => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/students/${s.id}`} className="font-medium text-indigo-600 hover:underline">{s.name}</Link>
                </td>
                <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{s.name_kana}</td>
                <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{s.phone}</td>
                <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">{s.email}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {s.is_active ? '在籍' : '休会'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => openEdit(s)} className="text-gray-400 hover:text-indigo-600 mr-2"><Pencil size={15} /></button>
                  <button onClick={() => handleDelete(s.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={15} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">{editing ? '生徒を編集' : '新規生徒追加'}</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600">名前 *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">よみがな</label>
                <input value={form.name_kana} onChange={e => setForm(f => ({ ...f, name_kana: e.target.value }))} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">メール</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">電話番号</label>
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">生年月日</label>
                <input type="date" value={form.birthdate} onChange={e => setForm(f => ({ ...f, birthdate: e.target.value }))} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">備考</label>
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
