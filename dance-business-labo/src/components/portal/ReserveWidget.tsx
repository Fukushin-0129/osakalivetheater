'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, CheckCircle, Clock, Loader2, MapPin } from 'lucide-react'

interface Lesson {
  id: string
  title: string
  scheduled_at: string
  location: string | null
  max_capacity: number
  enrolled_count: number
  is_reserved: boolean
  lesson_types: { name: string; duration_minutes: number } | null
}

// APIから返るタイムスタンプは常にJSTの日時として扱う（UTC変換しない）
function parseJST(s: string): Date {
  const clean = s.slice(0, 16).replace(' ', 'T')
  const [datePart, timePart] = clean.split('T')
  const [y, m, d] = datePart.split('-').map(Number)
  const [h, min] = (timePart ?? '00:00').split(':').map(Number)
  return new Date(y, m - 1, d, h, min)
}

const SHOW_COUNT = 3

export default function ReserveWidget() {
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [loading, setLoading] = useState(true)
  const [busyLesson, setBusyLesson] = useState<string | null>(null)
  const [error, setError] = useState('')

  const loadLessons = useCallback(async () => {
    try {
      const response = await fetch('/api/portal/lessons', { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'レッスンを読み込めませんでした')
      setLessons(result.lessons ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'レッスンを読み込めませんでした')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadLessons() }, [loadLessons])

  async function updateReservation(lesson: Lesson) {
    if (lesson.is_reserved && !window.confirm('このレッスンの予約をキャンセルしますか？')) return

    setBusyLesson(lesson.id)
    setError('')
    try {
      const response = await fetch(
        lesson.is_reserved ? `/api/portal/lessons?lesson_id=${encodeURIComponent(lesson.id)}` : '/api/portal/lessons',
        lesson.is_reserved
          ? { method: 'DELETE' }
          : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lesson_id: lesson.id }) }
      )
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '予約を更新できませんでした')
      await loadLessons()
    } catch (err) {
      setError(err instanceof Error ? err.message : '予約を更新できませんでした')
    } finally {
      setBusyLesson(null)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-700 flex items-center gap-2"><CalendarDays size={16} className="text-indigo-500" /> レッスン予約</h2>
        <Link href="/portal/reserve" className="text-xs text-indigo-600 hover:underline">すべて見る →</Link>
      </div>

      {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center py-6 text-gray-400"><Loader2 size={18} className="animate-spin mr-2" />読み込み中...</div>
      ) : lessons.length === 0 ? (
        <p className="text-gray-400 text-sm">現在、予約できるレッスンはありません</p>
      ) : (
        <div className="space-y-2">
          {lessons.slice(0, SHOW_COUNT).map(lesson => {
            const date = parseJST(lesson.scheduled_at)
            const full = lesson.enrolled_count >= lesson.max_capacity
            const isBusy = busyLesson === lesson.id
            return (
              <div key={lesson.id} className={`flex items-center gap-3 rounded-lg border p-3 ${lesson.is_reserved ? 'border-indigo-200 bg-indigo-50/50' : 'border-gray-100'}`}>
                <div className="w-11 flex-shrink-0 text-center">
                  <div className="text-lg font-bold leading-tight text-indigo-700">{date.getDate()}</div>
                  <div className="text-[10px] text-gray-500">{date.toLocaleDateString('ja-JP', { weekday: 'short' })}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-800">{lesson.title}</p>
                  <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-gray-500">
                    <span className="inline-flex items-center gap-0.5"><Clock size={10} />{date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</span>
                    {lesson.location && <span className="inline-flex items-center gap-0.5 truncate"><MapPin size={10} />{lesson.location}</span>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void updateReservation(lesson)}
                  disabled={isBusy || (!lesson.is_reserved && full)}
                  className={`flex-shrink-0 flex min-h-8 items-center justify-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${lesson.is_reserved ? 'bg-indigo-100 text-indigo-700 hover:bg-red-50 hover:text-red-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                >
                  {isBusy ? <Loader2 size={13} className="animate-spin" /> : lesson.is_reserved ? <><CheckCircle size={13} />予約済</> : full ? '満席' : '予約する'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
