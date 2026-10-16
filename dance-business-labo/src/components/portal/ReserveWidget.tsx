'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, CheckCircle, Clock, Loader2, MapPin, X } from 'lucide-react'

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

type DialogState = { type: 'reserve'; lesson: Lesson; note: string } | { type: 'cancel'; lesson: Lesson; note: string } | null

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
  const [dialog, setDialog] = useState<DialogState>(null)
  const [submitting, setSubmitting] = useState(false)

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

  async function submitReserve(lesson: Lesson, note: string) {
    setSubmitting(true)
    setBusyLesson(lesson.id)
    setError('')
    try {
      const response = await fetch('/api/portal/lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lesson_id: lesson.id, note }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '予約を更新できませんでした')
      setDialog(null)
      await loadLessons()
    } catch (err) {
      setError(err instanceof Error ? err.message : '予約を更新できませんでした')
    } finally {
      setSubmitting(false)
      setBusyLesson(null)
    }
  }

  async function submitCancel(lesson: Lesson, note: string) {
    setSubmitting(true)
    setBusyLesson(lesson.id)
    setError('')
    try {
      const response = await fetch(`/api/portal/lessons?lesson_id=${encodeURIComponent(lesson.id)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '予約を更新できませんでした')
      setDialog(null)
      await loadLessons()
    } catch (err) {
      setError(err instanceof Error ? err.message : '予約を更新できませんでした')
    } finally {
      setSubmitting(false)
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
                  onClick={() => setDialog(lesson.is_reserved ? { type: 'cancel', lesson, note: '' } : { type: 'reserve', lesson, note: '' })}
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

      {dialog && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
          <div className="flex w-full max-h-[90vh] flex-col rounded-t-2xl bg-white sm:max-w-md sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="text-lg font-bold text-gray-800">{dialog.type === 'reserve' ? 'レッスンを予約' : '予約をキャンセル'}</h2>
              <button onClick={() => setDialog(null)} className="p-1 text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              <p className="text-sm text-gray-600">{dialog.lesson.title}</p>

              {dialog.type === 'reserve' ? (
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">事情・ご要望（任意）</label>
                  <textarea
                    value={dialog.note}
                    onChange={e => setDialog({ ...dialog, note: e.target.value })}
                    rows={3}
                    placeholder="例: 少し遅れて到着します"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-700 mb-3">このレッスンの予約をキャンセルしますか？</p>
                  <label className="mb-1 block text-xs font-medium text-gray-600">事情・理由（任意）</label>
                  <textarea
                    value={dialog.note}
                    onChange={e => setDialog({ ...dialog, note: e.target.value })}
                    rows={3}
                    placeholder="例: 体調不良のため"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3 border-t border-gray-100 px-6 py-4">
              <button onClick={() => setDialog(null)} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm text-gray-600 hover:bg-gray-50">キャンセル</button>
              <button
                onClick={() => {
                  if (dialog.type === 'reserve') void submitReserve(dialog.lesson, dialog.note)
                  else void submitCancel(dialog.lesson, dialog.note)
                }}
                disabled={submitting}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-indigo-400"
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                {dialog.type === 'reserve' ? '予約する' : 'キャンセルする'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
