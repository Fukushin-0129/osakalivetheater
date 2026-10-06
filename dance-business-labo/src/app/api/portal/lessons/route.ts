import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedPortalStudent } from '@/lib/portal/auth'

export async function GET() {
  const { student, admin } = await getAuthenticatedPortalStudent()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 403 })

  const now = new Date().toISOString()
  const [{ data: lessons, error: lessonsError }, { data: reservations, error: reservationsError }] = await Promise.all([
    admin.from('lessons')
      .select('id, title, scheduled_at, location, max_capacity, lesson_types(name, duration_minutes)')
      .gte('scheduled_at', now)
      .order('scheduled_at')
      .limit(50),
    admin.from('student_reservations')
      .select('lesson_id')
      .eq('student_id', student.id),
  ])

  if (lessonsError || reservationsError) {
    console.error('Failed to load portal lessons:', lessonsError || reservationsError)
    return NextResponse.json({ error: 'Failed to load lessons' }, { status: 500 })
  }

  const lessonIds = (lessons ?? []).map((lesson) => lesson.id)
  const [{ data: reservationCounts, error: reservationCountsError }, { data: attendanceCounts, error: attendanceCountsError }] = lessonIds.length
    ? await Promise.all([
        admin.from('student_reservations').select('lesson_id, student_id').in('lesson_id', lessonIds),
        admin.from('attendance').select('lesson_id, student_id, status').in('lesson_id', lessonIds).in('status', ['present', 'late']),
      ])
    : [{ data: [], error: null }, { data: [], error: null }]

  if (reservationCountsError || attendanceCountsError) {
    console.error('Failed to load reservation counts:', reservationCountsError || attendanceCountsError)
    return NextResponse.json({ error: 'Failed to load lessons' }, { status: 500 })
  }

  const reservedIds = new Set((reservations ?? []).map((reservation) => reservation.lesson_id))
  const studentsByLesson = new Map<string, Set<string>>()
  for (const reservation of reservationCounts ?? []) {
    const students = studentsByLesson.get(reservation.lesson_id) ?? new Set<string>()
    students.add(reservation.student_id)
    studentsByLesson.set(reservation.lesson_id, students)
  }
  for (const attendance of attendanceCounts ?? []) {
    const students = studentsByLesson.get(attendance.lesson_id) ?? new Set<string>()
    students.add(attendance.student_id)
    studentsByLesson.set(attendance.lesson_id, students)
  }

  return NextResponse.json({
    lessons: (lessons ?? []).map((lesson) => ({
      ...lesson,
      is_reserved: reservedIds.has(lesson.id),
      enrolled_count: studentsByLesson.get(lesson.id)?.size ?? 0,
    })),
  })
}

export async function POST(request: NextRequest) {
  const { student, admin } = await getAuthenticatedPortalStudent()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const lessonId = body?.lesson_id
  if (typeof lessonId !== 'string' || !lessonId) {
    return NextResponse.json({ error: 'lesson_id is required' }, { status: 400 })
  }

  const { data, error } = await admin.rpc('create_student_lesson_reservation', {
    p_student_id: student.id,
    p_lesson_id: lessonId,
  })

  if (error) {
    if (error.message.includes('ALREADY_RESERVED') || error.code === '23505') {
      return NextResponse.json({ error: 'すでに予約済みです' }, { status: 409 })
    }
    if (error.message.includes('LESSON_FULL')) {
      return NextResponse.json({ error: 'このレッスンは満席です' }, { status: 409 })
    }
    if (error.message.includes('LESSON_NOT_FOUND')) {
      return NextResponse.json({ error: 'レッスンが見つからないか、受付期間外です' }, { status: 404 })
    }
    if (error.code === '22P02') return NextResponse.json({ error: 'レッスンを指定できませんでした' }, { status: 400 })
    console.error('Failed to reserve lesson:', error)
    return NextResponse.json({ error: '予約に失敗しました' }, { status: 500 })
  }

  return NextResponse.json({ reservation: data }, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const { student, admin } = await getAuthenticatedPortalStudent()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 403 })

  const lessonId = request.nextUrl.searchParams.get('lesson_id')
  if (!lessonId) return NextResponse.json({ error: 'lesson_id is required' }, { status: 400 })
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lessonId)) {
    return NextResponse.json({ error: 'lesson_id is invalid' }, { status: 400 })
  }

  const { error } = await admin.rpc('cancel_student_lesson_reservation', {
    p_student_id: student.id,
    p_lesson_id: lessonId,
  })

  if (error) {
    if (error.message.includes('LESSON_NOT_CANCELLABLE')) {
      return NextResponse.json({ error: '開始後のレッスンはキャンセルできません' }, { status: 409 })
    }
    console.error('Failed to cancel lesson reservation:', error)
    return NextResponse.json({ error: '予約のキャンセルに失敗しました' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
