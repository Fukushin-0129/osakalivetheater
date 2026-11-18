'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type VideoOption = { id: string; label: string; assignable: boolean }

export default function WeeklyPracticeEditor({
  studentId, weekStart, videos, assignedIds, loadFailed,
}: {
  studentId: string
  weekStart: string
  videos: VideoOption[]
  assignedIds: string[]
  loadFailed: boolean
}) {
  const [assigned, setAssigned] = useState(assignedIds)
  const [selectedId, setSelectedId] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const options = videos.filter(video => video.assignable && !assigned.includes(video.id))

  async function changeAssignment(id: string, add: boolean) {
    if (saving || !id) return
    setSaving(true)
    setError('')
    setMessage('')
    const table = createClient().from('student_weekly_practice')
    try {
      if (add) {
        const { error } = await table.upsert({
          student_id: studentId, week_start: weekStart, curriculum_item_id: id,
        }, { onConflict: 'student_id,week_start,curriculum_item_id', ignoreDuplicates: true })
        if (error) throw error
        setAssigned(ids => ids.includes(id) ? ids : [...ids, id])
        setSelectedId('')
      } else {
        const { error } = await table.delete()
          .eq('student_id', studentId).eq('week_start', weekStart).eq('curriculum_item_id', id)
        if (error) throw error
        setAssigned(ids => ids.filter(assignedId => assignedId !== id))
      }
      setMessage(add ? '練習動画を追加しました。' : '練習動画を外しました。')
    } catch {
      setError('練習動画を更新できませんでした。もう一度お試しください。')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="mb-4 rounded-xl bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-gray-800">今週の練習動画</h2>
      <p className="mt-1 text-sm text-gray-500">
        {weekStart}（月）からの1週間に、生徒ポータルで表示する動画を選びます。
      </p>
      {loadFailed ? (
        <p role="alert" className="mt-3 text-sm text-red-600">練習動画を読み込めませんでした。</p>
      ) : (
        <>
          {options.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <select aria-label="カリキュラムの練習動画" value={selectedId} disabled={saving}
                onChange={event => setSelectedId(event.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm">
                <option value="">カリキュラムの動画を選択</option>
                {options.map(video => <option key={video.id} value={video.id}>{video.label}</option>)}
              </select>
              <button type="button" disabled={!selectedId || saving}
                onClick={() => void changeAssignment(selectedId, true)}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-50">
                追加
              </button>
            </div>
          ) : (
            <p className="mt-3 text-sm text-gray-500">追加できる動画がありません。動画はカリキュラムで登録できます。</p>
          )}
          {assigned.length > 0 && (
            <ul className="mt-3 divide-y divide-gray-100">
              {assigned.map(id => {
                const video = videos.find(option => option.id === id)
                return (
                  <li key={id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span>{video?.label ?? 'カリキュラム項目'}{!video?.assignable && '（動画なし）'}</span>
                    <button type="button" disabled={saving} onClick={() => void changeAssignment(id, false)}
                      aria-label={`${video?.label ?? '練習動画'}を外す`}
                      className="shrink-0 rounded-md px-2 py-1 text-gray-600 hover:bg-gray-100 disabled:opacity-50">
                      外す
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
          {message && <p role="status" className="mt-3 text-sm text-indigo-700">{message}</p>}
        </>
      )}
    </section>
  )
}
