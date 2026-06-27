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

    // Get student email from query param
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

    // Get payment history
    const { data: payments, error: paymentError } = await supabase
      .from('student_payments')
      .select('*')
      .eq('student_id', student.id)
      .order('payment_date', { ascending: false })

    if (paymentError) throw paymentError

    // Calculate statistics
    const thisMonth = new Date()
    thisMonth.setDate(1)
    thisMonth.setHours(0, 0, 0, 0)

    const monthlyPayments = (payments || []).filter(
      (p) => new Date(p.payment_date) >= thisMonth
    )

    const totalMonthly = monthlyPayments.reduce((sum, p) => sum + p.amount, 0)
    const completedCount = monthlyPayments.filter(
      (p) => p.status === 'completed'
    ).length
    const pendingCount = monthlyPayments.filter(
      (p) => p.status === 'pending'
    ).length

    return NextResponse.json({
      data: payments || [],
      summary: {
        totalMonthly,
        completedCount,
        pendingCount,
        thisMonthPayments: monthlyPayments,
      },
    })
  } catch (error) {
    console.error('Error fetching payments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch payments' },
      { status: 500 }
    )
  }
}
