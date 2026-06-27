import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const getSupabase = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase()

    // Get current user from auth
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // For demo: extract user email from header or query param
    const userEmail = req.nextUrl.searchParams.get('email')
    if (!userEmail) {
      return NextResponse.json(
        { error: 'email parameter required' },
        { status: 400 }
      )
    }

    // Get student
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id')
      .eq('email', userEmail)
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
