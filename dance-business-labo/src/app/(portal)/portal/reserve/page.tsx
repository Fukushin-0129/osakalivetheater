'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Lesson } from '@/types/database'
import { Calendar, MapPin, Users, Clock, CheckCircle, Loader2 } from 'lucide-react'

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

export default function PortalReservePage() {
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [loading, setLoading] = useState(true)
  const [reserving, setReserving] = useState<string | null>(null)
  const [reserved, setReserved] = useState<Set<string>>(new Set())
  const [studentId, setStudentId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: student } = await supabase
        .from('students')
        .select('id')
        .eq('email', user.email ?? '')
        .single()

      if (student) {
        setStudentId(student.id)

        const [{ data: ls }, { data: att }] = await Promise.all([
          supabase.from('lessons').select('*').gte('scheduled_at', new Date().toISOString()).order('scheduled_at').limit(20),
          supabase.from('attendance').select('lesson_id').eq('student_id', student.id),
        ])
        setLessons(ls ?? [])
        setReserved(new Set((att ?? []).map(a => a.lesson_id)))
      }
      setLoading(false)
    }
    init()
  }, [])

  async function handleReserve(lesson: Lesson) {
    if (!studentId) return
    setReserving(lesson.id)
    if (reserved.has(lesson.id)) {
      // キャンセル
      await supabase.from('attendance').delete().eq('lesson_id', lesson.id).eq('student_id', studentId)
      setReserved(prev => { const n = new Set(prev); n.delete(lesson.id); return n })
    } else {
      // 予約（出席記録として保存）
      await supabase.from('attendance').upsert({
        lesson_id: lesson.id,
        student_id: studentId,
        status: 'present',
        ticket_used: false,
      }, { onConflict: 'lesson_id,student_id' })
      setReserved(prev => new Set([...prev, lesson.id]))
    }
    setReserving(null)
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
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Calendar size={20} className="text-indigo-500" /> レッスン予約
        </h1>
        <p className="text-gray-500 text-sm mt-1">参加したいレッスンを選んでください</p>
      </div>

      {lessons.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-400">
          <Calendar size={32} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">予定されているレッスンはありません</p>
        </div>
      ) : (
        <div className="space-y-3">
          {lessons.map(l => {
            const dt = new Date(l.scheduled_at)
            const isReserved = reserved.has(l.id)
            const isReserving = reserving === l.id
            const dayOfWeek = dt.getDay()
            return (
              <div key={l.id} className={`bg-white rounded-xl shadow-sm p-4 flex items-center gap-4 transition-all ${isReserved ? 'border-2 border-indigo-400' : 'border-2 border-transparent'}`}>
                {/* 日付 */}
                <div className="flex-shrink-0 w-14 text-center">
                  <div className={`text-2xl font-bold ${dayOfWeek === 0 ? 'text-red-500' : dayOfWeek === 6 ? 'text-blue-500' : 'text-gray-800'}`}>
                    {dt.getDate()}
                  </div>
                  <div className={`text-xs font-medium ${dayOfWeek === 0 ? 'text-red-400' : dayOfWeek === 6 ? 'text-blue-400' : 'text-gray-400'}`}>
                    {dt.toLocaleDateString('ja-JP', { month: 'numeric' })}月{WEEKDAYS[dayOfWeek]}
                  </div>
                </div>

                {/* 区切り */}
                <div className="w-px h-12 bg-gray-100 flex-shrink-0" />

                {/* 詳細 */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-800 text-sm">{l.title}</div>
                  <div className="flex flex-wrap gap-x-3 mt-1">
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock size={11} />
                      {dt.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                      {l.lesson_types && ` (${(l.lesson_types as { duration_minutes: number }).duration_minutes}分)`}
                    </span>
                    {l.location && (
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <MapPin size={11} /> {l.location}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Users size={11} /> 定員{l.max_capacity}名
                    </span>
                  </div>
                </div>

                {/* 予約ボタン */}
                <button
                  onClick={() => handleReserve(l)}
                  disabled={isReserving}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    isReserved
                      ? 'bg-indigo-100 text-indigo-700 hover:bg-red-50 hover:text-red-600'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
                >
                  {isReserving ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : isReserved ? (
                    <><CheckCircle size={14} /> 予約済</>
                  ) : (
                    '予約する'
                  )}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
