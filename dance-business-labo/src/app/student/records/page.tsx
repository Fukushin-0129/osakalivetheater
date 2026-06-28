'use client'

import { useEffect, useState } from 'react'
import { Calendar, User, MessageCircle } from 'lucide-react'

interface Record {
  id: string
  record_date: string
  instructor: string
  content: string
  lesson_title: string
}

export default function RecordsPage() {
  const [records, setRecords] = useState<Record[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // TODO: API から実際のカルテ情報を取得
    // 現在はダミーデータを表示
    setRecords([
      {
        id: '1',
        record_date: '2026-06-28',
        instructor: '田中太郎',
        lesson_title: 'タップダンス初心者クラス',
        content:
          'リズム感が良くなってきました。次回は足の正確性を意識して練習してください。特に右足のタイミングが少し遅れていますので、クリックトラックに合わせてもう一度復習しましょう。',
      },
      {
        id: '2',
        record_date: '2026-06-21',
        instructor: '田中太郎',
        lesson_title: 'タップダンス初心者クラス',
        content:
          '基本的なステップがしっかり身についてきています。フラップの音が綺麗になっています。来週からシャッフルに進む準備ができていますので、楽しみにしていてください。',
      },
      {
        id: '3',
        record_date: '2026-06-14',
        instructor: '田中太郎',
        lesson_title: 'タップダンス初心者クラス',
        content:
          'バックステップの基本を学びました。最初は難しそうでしたが、後半は上達が見られました。毎日5分でいいので、自宅で基本ステップを練習してくると、次のレッスンがもっとスムーズになります。',
      },
    ])
    setLoading(false)
  }, [])

  if (loading) {
    return <div className="text-center py-12">読み込み中...</div>
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">📝 カルテ</h1>

      {records.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <p className="text-gray-600">先生からのメモはまだありません</p>
        </div>
      ) : (
        <div className="space-y-4">
          {records.map((record) => (
            <div
              key={record.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
            >
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {record.lesson_title}
                  </h3>
                  <span className="text-sm text-gray-500">
                    {new Date(record.record_date).toLocaleDateString('ja-JP')}
                  </span>
                </div>
                <p className="text-sm text-gray-600">講師: {record.instructor}</p>
              </div>

              <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                <div className="flex gap-2 mb-2">
                  <MessageCircle size={18} className="text-blue-600 flex-shrink-0" />
                  <p className="text-gray-700 whitespace-pre-wrap">{record.content}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
