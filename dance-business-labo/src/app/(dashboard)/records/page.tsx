'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Student, StudentRecord } from '@/types/database'
import { Plus, Trash2 } from 'lucide-react'

export default function RecordsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [selectedStudent, setSelectedStudent] = useState<string>('')
  const [records, setRecords] = useState<StudentRecord[]>([])
  const [newContent, setNewContent] = useState('')
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0])
  const supabase = createClient()

  useEffect(() => {
    supabase.from('students').select('id, name, name_kana').eq('is_active', true).order('name_kana').then(({ data }) => setStudents(data as Student[] ?? []))
  }, [])

  useEffect(() => {
    if (!selectedStudent) return
    supabase.from('student_records').select('*').eq('student_id', selectedStudent).order('record_date', { ascending: false }).then(({ data }) => setRecords(data ?? []))
  }, [selectedStudent])

  async function addRecord() {
    if (!selectedStudent || !newContent.trim()) return
    const { data } = await supabase.from('student_records').insert({ student_id: selectedStudent, content: newContent, record_date: newDate }).select().single()
    if (data) {
      setRecords(prev => [data, ...prev])
      setNewContent('')
    }
  }

  async function deleteRecord(id: string) {
    await supabase.from('student_records').delete().eq('id', id)
    setRecords(prev => prev.filter(r => r.id !== id))
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">カルテ管理</h1>

      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <label className="text-xs font-medium text-gray-600 block mb-1">生徒を選択</label>
        <select
          value={selectedStudent}
          onChange={e => setSelectedStudent(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">-- 生徒を選んでください --</option>
          {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {selectedStudent && (
        <>
          <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">新規記録を追加</h2>
            <div className="flex gap-2 mb-2">
              <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <textarea
              value={newContent}
              onChange={e => setNewContent(e.target.value)}
              rows={4}
              placeholder="レッスンの内容、生徒の状態、気づきなど..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-3"
            />
            <button onClick={addRecord} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
              <Plus size={16} /> 記録を追加
            </button>
          </div>

          <div className="space-y-3">
            {records.length === 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6 text-center text-gray-400 text-sm">記録がありません</div>
            )}
            {records.map(r => (
              <div key={r.id} className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{r.record_date}</span>
                  <button onClick={() => deleteRecord(r.id)} className="text-gray-300 hover:text-red-400"><Trash2 size={14} /></button>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{r.content}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
