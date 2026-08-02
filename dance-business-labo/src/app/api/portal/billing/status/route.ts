import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    // 生徒の特定はログイン中のセッション（メール）から行う。以前はクエリパラメータの
    // emailをそのまま信用しており、ログインすらせず任意のメールアドレスを指定するだけで
    // 他人の支払い状況を閲覧できてしまっていた。
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id')
      .eq('email', user.email ?? '')
      .single()

    if (studentError || !student) {
      return NextResponse.json(
        { error: 'Student not found' },
        { status: 404 }
      )
    }

    // Get subscription
    const { data: subscription } = await supabase
      .from('student_subscriptions')
      .select('*, subscription_types(*)')
      .eq('student_id', student.id)
      .eq('status', 'active')
      .single()

    // Get tickets
    const { data: tickets } = await supabase
      .from('student_tickets')
      .select('*, ticket_types(*)')
      .eq('student_id', student.id)

    // Get recent payments
    const { data: payments } = await supabase
      .from('student_payments')
      .select('*')
      .eq('student_id', student.id)
      .order('payment_date', { ascending: false })
      .limit(5)

    const paymentType = subscription ? 'subscription' : tickets && tickets.length > 0 ? 'ticket' : null

    return NextResponse.json({
      data: {
        paymentType,
        subscription: subscription || null,
        tickets: tickets || [],
        recentPayments: payments || [],
        nextPaymentDate: subscription?.next_payment_date || null,
        isPaymentDue: subscription
          ? new Date(subscription.next_payment_date!) <= new Date()
          : false,
      },
    })
  } catch (error) {
    console.error('Error fetching billing status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch billing status' },
      { status: 500 }
    )
  }
}
