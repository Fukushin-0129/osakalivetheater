'use client'

import { useEffect, useState } from 'react'
import { Calendar, Clock, MapPin, User } from 'lucide-react'

interface Lesson {
  id: string
  title: string
  scheduled_at: string
  location: string
  instructor: string
  max_capacity: number
  enrolled_count: number
}

export default function ReservePage() {
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // TODO: API から実際のレッスン情報を取得
    // 現在はダミーデータを表示
    setLessons([
      {
        id: '1',
        title: 'タップダンス初心者クラス',
        scheduled_at: '2026-07-01T18:00:00',
        location: 'スタジオA',
        instructor: '田中太郎',
        max_capacity: 10,
        enrolled_count: 7,
      },
      {
        id: '2',
        title: 'タップダンス中級クラス',
        scheduled_at: '2026-07-02T19:00:00',
        location: 'スタジオB',
        instructor: '佐藤花子',
        max_capacity: 12,
        enrolled_count: 10,
      },
      {
        id: '3',
        title: 'タップダンス上級クラス',
        scheduled_at: '2026-07-03T20:00:00',
        location: 'スタジオA',
        instructor: '鈴木健一',
        max_capacity: 8,
        enrolled_count: 5,
      },
    ])
    setLoading(false)
  }, [])

  if (loading) {
    return <div className="text-center py-12">読み込み中...</div>
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">📅 レッスン予約</h1>

      <div className="space-y-4">
        {lessons.map((lesson) => (
          <div
            key={lesson.id}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition"
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {lesson.title}
                </h3>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Calendar size={16} />
                    {new Date(lesson.scheduled_at).toLocaleDateString('ja-JP')}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={16} />
                    {new Date(lesson.scheduled_at).toLocaleTimeString('ja-JP', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin size={16} />
                    {lesson.location}
                  </div>
                  <div className="flex items-center gap-2">
                    <User size={16} />
                    講師: {lesson.instructor}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600 mb-2">
                  {lesson.enrolled_count}/{lesson.max_capacity}
                </p>
                <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
                  予約する
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
