'use client'

import { useEffect, useState } from 'react'
import { Calendar, Clock, MapPin, User, Trash2, CheckCircle } from 'lucide-react'

interface BookedLesson {
  id: string
  title: string
  scheduled_at: string
  location: string
  instructor: string
  status: 'upcoming' | 'completed' | 'cancelled'
  booked_at: string
}

export default function MyLessonsPage() {
  const [lessons, setLessons] = useState<BookedLesson[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // TODO: API から実際の予約情報を取得
    // 現在はダミーデータを表示
    setLessons([
      {
        id: '1',
        title: 'タップダンス初心者クラス',
        scheduled_at: '2026-07-05T18:00:00',
        location: 'スタジオA',
        instructor: '田中太郎',
        status: 'upcoming',
        booked_at: '2026-06-20T10:00:00',
      },
      {
        id: '2',
        title: 'タップダンス中級クラス',
        scheduled_at: '2026-07-10T19:00:00',
        location: 'スタジオB',
        instructor: '佐藤花子',
        status: 'upcoming',
        booked_at: '2026-06-15T15:30:00',
      },
      {
        id: '3',
        title: 'タップダンス初心者クラス',
        scheduled_at: '2026-06-28T18:00:00',
        location: 'スタジオA',
        instructor: '田中太郎',
        status: 'completed',
        booked_at: '2026-06-10T09:00:00',
      },
    ])
    setLoading(false)
  }, [])

  const upcomingLessons = lessons.filter((l) => l.status === 'upcoming')
  const completedLessons = lessons.filter((l) => l.status === 'completed')

  if (loading) {
    return <div className="text-center py-12">読み込み中...</div>
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">📅 予約済みレッスン</h1>

      {/* 予定中のレッスン */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">📍 予定中</h2>
        {upcomingLessons.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <p className="text-gray-600">予定中のレッスンはありません</p>
          </div>
        ) : (
          <div className="space-y-4">
            {upcomingLessons.map((lesson) => (
              <div
                key={lesson.id}
                className="bg-blue-50 rounded-lg shadow-sm border border-blue-200 p-6"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
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
                  <button className="text-red-600 hover:text-red-700 p-2">
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 完了したレッスン */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">✅ 完了したレッスン</h2>
        {completedLessons.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <p className="text-gray-600">完了したレッスンはありません</p>
          </div>
        ) : (
          <div className="space-y-4">
            {completedLessons.map((lesson) => (
              <div
                key={lesson.id}
                className="bg-green-50 rounded-lg shadow-sm border border-green-200 p-6 opacity-75"
              >
                <div className="flex items-start gap-3">
                  <CheckCircle size={20} className="text-green-600 mt-1" />
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {lesson.title}
                    </h3>
                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Calendar size={16} />
                        {new Date(lesson.scheduled_at).toLocaleDateString('ja-JP')}
                      </div>
                      <div className="flex items-center gap-2">
                        <User size={16} />
                        講師: {lesson.instructor}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
