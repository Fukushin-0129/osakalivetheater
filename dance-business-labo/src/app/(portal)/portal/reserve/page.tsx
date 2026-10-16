'use client'

import { useCallback, useEffect, useState } from 'react'
import { CalendarDays, CheckCircle, Clock, Loader2, MapPin, Users, MessageCircleWarning, X } from 'lucide-react'

// APIから返るタイムスタンプは常にJSTの日時として扱う（UTC変換しない）
function parseJST(s: string): Date {
  const clean = s.slice(0, 16).replace(' ', 'T').replace('Z', '')
  const [datePart, timePart] = clean.split('T')
  const [y, m, d] = datePart.split('-').map(Number)
  const [h, min] = (timePart ?? '00:00').split(':').map(Number)
  return new Date(y, m - 1, d, h, min)
}

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

type DialogState =
  | { type: 'reserve'; lesson: Lesson; note: string }
  | { type: 'cancel'; lesson: Lesson }
  | { type: 'absence'; lesson: Lesson; reason: string }
  | null

export default function PortalReservePage() {
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [loading, setLoading] = useState(true)
  const [busyLesson, setBusyLesson] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [dialog, setDialog] = useState<DialogState>(null)
  const [submitting, setSubmitting] = useState(false)

  const loadLessons = useCallback(async () => {
    setError('')
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
    setMessage('')
    try {
      const response = await fetch('/api/portal/lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lesson_id: lesson.id, note }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '予約を更新できませんでした')
      setMessage('レッスンを予約しました')
      setDialog(null)
      await loadLessons()
    } catch (err) {
      setError(err instanceof Error ? err.message : '予約を更新できませんでした')
    } finally {
      setSubmitting(false)
      setBusyLesson(null)
    }
  }

  async function submitCancel(lesson: Lesson) {
    setSubmitting(true)
    setBusyLesson(lesson.id)
    setError('')
    setMessage('')
    try {
      const response = await fetch(`/api/portal/lessons?lesson_id=${encodeURIComponent(lesson.id)}`, { method: 'DELETE' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '予約を更新できませんでした')
      setMessage('予約をキャンセルしました')
      setDialog(null)
      await loadLessons()
    } catch (err) {
      setError(err instanceof Error ? err.message : '予約を更新できませんでした')
    } finally {
      setSubmitting(false)
      setBusyLesson(null)
    }
  }

  async function submitAbsence(lesson: Lesson, reason: string) {
    setSubmitting(true)
    setBusyLesson(lesson.id)
    setError('')
    setMessage('')
    try {
      const response = await fetch('/api/portal/absence-notices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lesson_id: lesson.id, reason }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '欠席連絡を送れませんでした')
      setMessage('欠席連絡を送りました')
      setDialog(null)
      await loadLessons()
    } catch (err) {
      setError(err instanceof Error ? err.message : '欠席連絡を送れませんでした')
    } finally {
      setSubmitting(false)
      setBusyLesson(null)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-gray-500"><Loader2 size={22} className="mr-2 animate-spin" />読み込み中...</div>
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-xl font-bold text-gray-800"><CalendarDays size={21} className="text-indigo-600" />レッスン予約・予定</h1>
        <p className="mt-1 text-sm text-gray-600">参加したいレッスンを予約できます。</p>
      </div>

      {message && <p role="status" className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">{message}</p>}
      {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {lessons.length === 0 ? (
        <div className="rounded-xl bg-white p-8 text-center text-gray-500 shadow-sm">
          <CalendarDays size={30} className="mx-auto mb-3 text-gray-300" />
          <p className="font-medium">現在、予約できるレッスンはありません</p>
          <p className="mt-1 text-sm">新しいレッスンが登録されると、ここに表示されます。</p>
        </div>
      ) : (
        <div className="space-y-3">
          {lessons.map((lesson) => {
            const date = parseJST(lesson.scheduled_at)
            const full = lesson.enrolled_count >= lesson.max_capacity
            const isBusy = busyLesson === lesson.id

            return (
              <article key={lesson.id} className={`grid grid-cols-[3.25rem_minmax(0,1fr)] gap-x-3 gap-y-3 rounded-xl border bg-white p-4 shadow-sm sm:grid-cols-[3.5rem_minmax(0,1fr)_auto] sm:items-center ${lesson.is_reserved ? 'border-indigo-300' : 'border-gray-100'}`}>
                <div className="row-span-2 self-start text-center sm:row-span-1 sm:self-center">
                  <div className="text-2xl font-bold leading-tight text-indigo-700">{date.getDate()}</div>
                  <div className="text-xs text-gray-500">{date.toLocaleDateString('ja-JP', { month: 'short', weekday: 'short' })}</div>
                </div>

                <div className="min-w-0">
                  <h2 className="break-words font-semibold text-gray-900">{lesson.title}</h2>
                  {lesson.lesson_types?.name && <p className="mt-0.5 text-xs text-gray-500">{lesson.lesson_types.name}</p>}
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600">
                    <span className="inline-flex items-center gap-1"><Clock size={13} />{date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}{lesson.lesson_types?.duration_minutes ? `（${lesson.lesson_types.duration_minutes}分）` : ''}</span>
                    {lesson.location && <span className="inline-flex items-center gap-1"><MapPin size={13} />{lesson.location}</span>}
                    <span className="inline-flex items-center gap-1"><Users size={13} />{lesson.enrolled_count}/{lesson.max_capacity}名</span>
                  </div>
                </div>

                <div className="col-span-2 flex flex-col gap-2 sm:col-span-1 sm:items-end">
                  <button
                    type="button"
                    onClick={() => setDialog(lesson.is_reserved ? { type: 'cancel', lesson } : { type: 'reserve', lesson, note: '' })}
                    disabled={isBusy || (!lesson.is_reserved && full)}
                    className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto ${lesson.is_reserved ? 'bg-indigo-50 text-indigo-700 hover:bg-red-50 hover:text-red-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                  >
                    {isBusy ? <Loader2 size={16} className="animate-spin" /> : lesson.is_reserved ? <><CheckCircle size={16} />予約済み・キャンセル</> : full ? '満席' : '予約する'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDialog({ type: 'absence', lesson, reason: '' })}
                    disabled={isBusy}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <MessageCircleWarning size={13} />欠席連絡
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {dialog && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
          <div className="flex w-full max-h-[90vh] flex-col rounded-t-2xl bg-white sm:max-w-md sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="text-lg font-bold text-gray-800">
                {dialog.type === 'reserve' && 'レッスンを予約'}
                {dialog.type === 'cancel' && '予約をキャンセル'}
                {dialog.type === 'absence' && '欠席連絡'}
              </h2>
              <button onClick={() => setDialog(null)} className="p-1 text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              <p className="text-sm text-gray-600">{dialog.lesson.title}</p>

              {dialog.type === 'reserve' && (
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
              )}

              {dialog.type === 'cancel' && (
                <p className="text-sm text-gray-700">このレッスンの予約をキャンセルしますか？</p>
              )}

              {dialog.type === 'absence' && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">欠席の事情（任意）</label>
                  <textarea
                    value={dialog.reason}
                    onChange={e => setDialog({ ...dialog, reason: e.target.value })}
                    rows={3}
                    placeholder="例: 体調不良のため"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="mt-2 text-xs text-gray-400">予約している場合は、送信すると予約も取り消されます。</p>
                </div>
              )}
            </div>

            <div className="flex gap-3 border-t border-gray-100 px-6 py-4">
              <button onClick={() => setDialog(null)} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm text-gray-600 hover:bg-gray-50">キャンセル</button>
              <button
                onClick={() => {
                  if (dialog.type === 'reserve') void submitReserve(dialog.lesson, dialog.note)
                  if (dialog.type === 'cancel') void submitCancel(dialog.lesson)
                  if (dialog.type === 'absence') void submitAbsence(dialog.lesson, dialog.reason)
                }}
                disabled={submitting}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-indigo-400"
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                {dialog.type === 'reserve' && '予約する'}
                {dialog.type === 'cancel' && 'キャンセルする'}
                {dialog.type === 'absence' && '送信する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
