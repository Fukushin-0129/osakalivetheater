'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { StudentRecord } from '@/types/database'
import { Pencil, Trash2, Check, X, Plus, Loader2, Copy, ClipboardCheck } from 'lucide-react'

export default function StudentKarteSection({
  studentId,
  initialRecords,
}: {
  studentId: string
  initialRecords: StudentRecord[]
}) {
  const supabase = createClient()
  const [records, setRecords] = useState<StudentRecord[]>(initialRecords)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newContent, setNewContent] = useState('')
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0])
  const [addError, setAddError] = useState<string | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  function startEdit(r: StudentRecord) {
    setEditingId(r.id)
    setEditContent(r.content)
    setEditError(null)
  }

  async function copyRecord(r: StudentRecord) {
    try {
      await navigator.clipboard.writeText(r.content)
      setCopiedId(r.id)
      setTimeout(() => setCopiedId(id => id === r.id ? null : id), 1500)
    } catch {
      // クリップボードが使えない環境では何もしない
    }
  }

  async function saveEdit(id: string) {
    if (!editContent.trim()) return
    setSaving(true)
    setEditError(null)
    const { error } = await supabase.from('student_records').update({ content: editContent.trim() }).eq('id', id)
    if (error) {
      setEditError(error.message)
      setSaving(false)
      return
    }
    setRecords(prev => prev.map(r => r.id === id ? { ...r, content: editContent.trim() } : r))
    setSaving(false)
    setEditingId(null)
  }

  async function deleteRecord(id: string) {
    if (!confirm('この記録を削除しますか？')) return
    const { error } = await supabase.from('student_records').delete().eq('id', id)
    if (error) { alert(`削除に失敗しました: ${error.message}`); return }
    setRecords(prev => prev.filter(r => r.id !== id))
  }

  async function addRecord() {
    if (!newContent.trim()) return
    setSaving(true)
    setAddError(null)
    const { data, error } = await supabase
      .from('student_records')
      .insert({ student_id: studentId, content: newContent.trim(), record_date: newDate })
      .select().single()
    if (error) {
      setAddError(error.message)
      setSaving(false)
      return
    }
    if (data) setRecords(prev => [data as StudentRecord, ...prev].sort((a, b) => b.record_date.localeCompare(a.record_date)))
    setNewContent('')
    setNewDate(new Date().toISOString().split('T')[0])
    setSaving(false)
    setAdding(false)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-700">カルテ</h2>
        <button onClick={() => { setAdding(v => !v); setAddError(null) }}
          className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
          <Plus size={13} /> 追加
        </button>
      </div>

      {adding && (
        <div className="mb-4 p-3 bg-gray-50 rounded-xl space-y-2">
          <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <textarea
            value={newContent}
            onChange={e => setNewContent(e.target.value)}
            placeholder="記録内容"
            rows={3}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
          {addError && <p className="text-xs text-red-600">保存に失敗しました: {addError}</p>}
          <div className="flex gap-2 justify-end">
            <button onClick={() => setAdding(false)} className="text-xs text-gray-500 px-3 py-1.5 hover:bg-gray-100 rounded-lg">キャンセル</button>
            <button onClick={addRecord} disabled={saving || !newContent.trim()}
              className="flex items-center gap-1 text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} 保存
            </button>
          </div>
        </div>
      )}

      {records.length === 0 ? (
        <p className="text-gray-400 text-sm">記録なし</p>
      ) : (
        <ul className="space-y-3 text-sm">
          {records.map(r => (
            <li key={r.id} className="group">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-400">{r.record_date}</span>
                <div className="flex gap-1">
                  {editingId === r.id ? (
                    <>
                      <button onClick={() => saveEdit(r.id)} disabled={saving} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check size={13} /></button>
                      <button onClick={() => setEditingId(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded"><X size={13} /></button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => copyRecord(r)} title="コピー" className="p-1 text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 rounded">
                        {copiedId === r.id ? <ClipboardCheck size={13} className="text-green-600" /> : <Copy size={13} />}
                      </button>
                      <button onClick={() => startEdit(r)} title="編集" className="p-1 text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 rounded"><Pencil size={13} /></button>
                      <button onClick={() => deleteRecord(r.id)} title="削除" className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded"><Trash2 size={13} /></button>
                    </>
                  )}
                </div>
              </div>
              {editingId === r.id ? (
                <textarea
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  rows={4}
                  autoFocus
                  className="w-full border border-indigo-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              ) : null}
              {editingId === r.id && editError && <p className="text-xs text-red-600 mt-1">保存に失敗しました: {editError}</p>}
              {editingId !== r.id && (
                <div className="text-gray-700 whitespace-pre-wrap cursor-pointer" onClick={() => startEdit(r)}>{r.content}</div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
