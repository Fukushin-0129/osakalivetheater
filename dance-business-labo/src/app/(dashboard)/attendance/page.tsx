'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Lesson, Student, Attendance } from '@/types/database'

const statusOptions = [
  { value: 'present', label: '出席', color: 'bg-green-500' },
  { value: 'absent', label: '欠席', color: 'bg-red-400' },
  { value: 'late', label: '遅刻', color: 'bg-yellow-400' },
  { value: 'cancelled', label: 'キャンセル', color: 'bg-gray-400' },
]

export default function AttendancePage() {
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [selectedLesson, setSelectedLesson] = useState<string>('')
  const [attendance, setAttendance] = useState<Record<string, Attendance>>({})
  const supabase = createClient()

  useEffect(() => {
    supabase.from('lessons').select('*').order('scheduled_at', { ascending: false }).limit(30).then(({ data }) => setLessons(data ?? []))
    supabase.from('students').select('*').eq('is_active', true).order('name_kana').then(({ data }) => setStudents(data ?? []))
  }, [])

  useEffect(() => {
    if (!selectedLesson) return
    supabase.from('attendance').select('*').eq('lesson_id', selectedLesson).then(({ data }) => {
      const map: Record<string, Attendance> = {}
      for (const a of data ?? []) map[a.student_id] = a
      setAttendance(map)
    })
  }, [selectedLesson])

  async function setStatus(studentId: string, status: string) {
    if (!selectedLesson) return
    const existing = attendance[studentId]
    if (existing) {
      await supabase.from('attendance').update({ status }).eq('id', existing.id)
      setAttendance(prev => ({ ...prev, [studentId]: { ...prev[studentId], status: status as Attendance['status'] } }))
    } else {
      const { data } = await supabase.from('attendance').insert({ lesson_id: selectedLesson, student_id: studentId, status }).select().single()
      if (data) setAttendance(prev => ({ ...prev, [studentId]: data }))
    }
  }

  async function removeAttendance(studentId: string) {
    const existing = attendance[studentId]
    if (!existing) return
    await supabase.from('attendance').delete().eq('id', existing.id)
    setAttendance(prev => {
      const next = { ...prev }
      delete next[studentId]
      return next
    })
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">出席管理</h1>

      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <label className="text-xs font-medium text-gray-600 block mb-1">レッスンを選択</label>
        <select
          value={selectedLesson}
          onChange={e => setSelectedLesson(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">-- レッスンを選んでください --</option>
          {lessons.map(l => (
            <option key={l.id} value={l.id}>
              {new Date(l.scheduled_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short' })} — {l.title}
            </option>
          ))}
        </select>
      </div>

      {selectedLesson && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs">
              <tr>
                <th className="text-left px-4 py-3">生徒名</th>
                <th className="text-left px-4 py-3">出席状態</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {students.map(s => {
                const a = attendance[s.id]
                return (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{s.name}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {statusOptions.map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => setStatus(s.id, opt.value)}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition-opacity ${a?.status === opt.value ? `${opt.color} text-white` : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {a && (
                        <button onClick={() => removeAttendance(s.id)} className="text-xs text-gray-400 hover:text-red-500">削除</button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
