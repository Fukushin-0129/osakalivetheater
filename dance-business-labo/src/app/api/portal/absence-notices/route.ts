import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedPortalStudent } from '@/lib/portal/auth'
import { sendNotificationEmail } from '@/lib/email'

// APIから返るタイムスタンプは常にJSTの日時として扱う（UTC変換しない）
function formatJST(s: string): string {
  const clean = s.slice(0, 16).replace(' ', 'T')
  const [datePart, timePart] = clean.split('T')
  const [y, m, d] = datePart.split('-').map(Number)
  const [h, min] = (timePart ?? '00:00').split(':').map(Number)
  const date = new Date(y, m - 1, d, h, min)
  return date.toLocaleString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' })
}

export async function POST(request: NextRequest) {
  const { student, admin } = await getAuthenticatedPortalStudent()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const lessonId = body?.lesson_id
  const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 500) : ''
  if (typeof lessonId !== 'string' || !lessonId) {
    return NextResponse.json({ error: 'lesson_id is required' }, { status: 400 })
  }

  const { data: lesson } = await admin.from('lessons').select('title, scheduled_at').eq('id', lessonId).maybeSingle()
  if (!lesson) return NextResponse.json({ error: 'レッスンが見つかりません' }, { status: 404 })

  const { data: notice, error } = await admin
    .from('lesson_absence_notices')
    .insert({ student_id: student.id, lesson_id: lessonId, reason: reason || null })
    .select('token')
    .single()

  if (error) {
    console.error('Failed to create absence notice:', error)
    return NextResponse.json({ error: '欠席連絡の送信に失敗しました' }, { status: 500 })
  }

  // 予約していた場合は合わせて予約も取り消す
  await admin.rpc('cancel_student_lesson_reservation', { p_student_id: student.id, p_lesson_id: lessonId }).then(
    () => {},
    () => {}
  )

  const ackUrl = `${request.nextUrl.origin}/api/notices/respond?token=${notice.token}&action=ack`
  void sendNotificationEmail(
    `【欠席連絡】${student.name}さんから連絡があります`,
    `${student.name}さんから、以下のレッスンについて欠席の連絡がありました。\n\nレッスン: ${lesson.title}\n日時: ${formatJST(lesson.scheduled_at)}${reason ? `\n事情: ${reason}` : ''}\n\n確認した場合は、以下のリンクを開いてください（アプリを開く必要はありません）。\n${ackUrl}`
  )

  return NextResponse.json({ success: true }, { status: 201 })
}
