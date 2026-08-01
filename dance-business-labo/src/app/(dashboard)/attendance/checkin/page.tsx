'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import jsQR from 'jsqr'
import { createClient } from '@/lib/supabase/client'
import type { Lesson, Student, Attendance } from '@/types/database'
import { ArrowLeft, Camera, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'

function parseJST(s: string): Date {
  const clean = s.slice(0, 16).replace(' ', 'T')
  const [y, m, d] = clean.slice(0, 10).split('-').map(Number)
  const [h, min] = clean.slice(11).split(':').map(Number)
  return new Date(y, m - 1, d, h, min)
}

function formatLesson(l: Lesson) {
  return parseJST(l.scheduled_at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' }) + ' ' + l.title
}

type ScanResult = { type: 'success' | 'duplicate' | 'error'; message: string }

export default function CheckinPage() {
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [selectedLesson, setSelectedLesson] = useState('')
  const [attendance, setAttendance] = useState<Record<string, Attendance>>({})
  const [scanning, setScanning] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<ScanResult | null>(null)
  const [loading, setLoading] = useState(true)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const cooldownRef = useRef<Set<string>>(new Set())

  const supabase = createClient()

  useEffect(() => {
    const from = new Date()
    from.setHours(0, 0, 0, 0)
    const to = new Date()
    to.setDate(to.getDate() + 1)
    to.setHours(0, 0, 0, 0)

    Promise.all([
      supabase.from('lessons').select('*')
        .gte('scheduled_at', from.toISOString())
        .lt('scheduled_at', to.toISOString())
        .order('scheduled_at', { ascending: true }),
      supabase.from('students').select('*').eq('is_active', true),
    ]).then(([{ data: l }, { data: s }]) => {
      const ls = l ?? []
      setLessons(ls)
      setStudents(s ?? [])
      if (ls.length > 0) setSelectedLesson(ls[0].id)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!selectedLesson) { setAttendance({}); return }
    supabase.from('attendance').select('*').eq('lesson_id', selectedLesson).then(({ data }) => {
      const map: Record<string, Attendance> = {}
      for (const a of data ?? []) map[a.student_id] = a
      setAttendance(map)
    })
  }, [selectedLesson])

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setScanning(false)
  }, [])

  useEffect(() => () => stopCamera(), [stopCamera])

  async function handleToken(token: string) {
    if (!selectedLesson) return
    if (cooldownRef.current.has(token)) return
    cooldownRef.current.add(token)
    setTimeout(() => cooldownRef.current.delete(token), 4000)

    const student = students.find(s => s.qr_token === token)
    if (!student) {
      setLastResult({ type: 'error', message: '未登録のQRコードです' })
      return
    }
    if (attendance[student.id]?.status === 'present') {
      setLastResult({ type: 'duplicate', message: `${student.name}さんは既にチェックイン済みです` })
      return
    }

    const existing = attendance[student.id]
    let row: Attendance | null = null
    if (existing) {
      const { data } = await supabase.from('attendance').update({ status: 'present' }).eq('id', existing.id).select().single()
      row = data
    } else {
      const { data } = await supabase.from('attendance').insert({ lesson_id: selectedLesson, student_id: student.id, status: 'present' }).select().single()
      row = data
    }
    if (row) setAttendance(prev => ({ ...prev, [student.id]: row! }))

    const lessonData = lessons.find(l => l.id === selectedLesson)
    const lessonDate = lessonData ? lessonData.scheduled_at.slice(0, 10) : new Date().toISOString().slice(0, 10)
    let cardCompletedMsg = ''
    try {
      const res = await fetch('/api/dashboard/tickets/consume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: student.id, lesson_date: lessonDate }),
      })
      const result = await res.json()
      if (result.cardCompleted) cardCompletedMsg = '（4回スタンプ達成！5000円のご案内をお願いします）'
    } catch {
      // 出席登録はできているのでチケット消化の失敗は無視
    }

    setLastResult({ type: 'success', message: `${student.name}さん チェックイン完了 ${cardCompletedMsg}` })
  }

  async function startCamera() {
    setCameraError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setScanning(true)
      tick()
    } catch {
      setCameraError('カメラにアクセスできませんでした。ブラウザのカメラ権限を確認してください。')
    }
  }

  function tick() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const code = jsQR(imageData.data, imageData.width, imageData.height)
        if (code?.data) handleToken(code.data.trim())
      }
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  const presentCount = Object.values(attendance).filter(a => a.status === 'present').length

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/attendance" className="text-gray-400 hover:text-gray-600"><ArrowLeft size={20} /></Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">QRチェックイン</h1>
          <p className="text-gray-500 text-sm mt-0.5">生徒のQRコードをカメラにかざして出席登録（スタンプの代わり）</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <label className="block text-xs font-medium text-gray-600 mb-1.5">本日のレッスン</label>
        {loading ? (
          <div className="text-gray-400 text-sm flex items-center gap-2"><Loader2 size={14} className="animate-spin" />読み込み中...</div>
        ) : lessons.length === 0 ? (
          <p className="text-gray-400 text-sm">本日のレッスンが登録されていません</p>
        ) : (
          <select value={selectedLesson} onChange={e => setSelectedLesson(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            {lessons.map(l => <option key={l.id} value={l.id}>{formatLesson(l)}</option>)}
          </select>
        )}
        {selectedLesson && <p className="text-xs text-gray-400 mt-2">チェックイン済み: {presentCount}名</p>}
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <div className="relative rounded-xl overflow-hidden bg-gray-900 aspect-video flex items-center justify-center">
          <video ref={videoRef} className={`w-full h-full object-cover ${scanning ? '' : 'hidden'}`} muted playsInline />
          <canvas ref={canvasRef} className="hidden" />
          {!scanning && (
            <div className="text-center text-gray-400 p-6">
              <Camera size={28} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">カメラを起動してQRコードを読み取ります</p>
            </div>
          )}
        </div>
        <div className="mt-3 flex gap-2">
          {!scanning ? (
            <button onClick={startCamera} disabled={!selectedLesson}
              className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white py-2.5 rounded-xl text-sm font-medium">
              <Camera size={16} /> カメラを起動
            </button>
          ) : (
            <button onClick={stopCamera}
              className="flex-1 flex items-center justify-center gap-2 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50">
              停止
            </button>
          )}
        </div>
        {cameraError && (
          <div className="mt-3 flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">
            <AlertTriangle size={14} /> {cameraError}
          </div>
        )}
        <p className="text-xs text-gray-400 mt-2">
          カメラが使えない場合は、従来どおり「出席管理」ページで手動スタンプ（出席ボタン）を押してください。両方の方法を併用できます。
        </p>
      </div>

      {lastResult && (
        <div className={`rounded-xl px-4 py-3 text-sm flex items-center gap-2 ${
          lastResult.type === 'success' ? 'bg-green-50 text-green-700' :
          lastResult.type === 'duplicate' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
        }`}>
          {lastResult.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {lastResult.message}
        </div>
      )}
    </div>
  )
}
