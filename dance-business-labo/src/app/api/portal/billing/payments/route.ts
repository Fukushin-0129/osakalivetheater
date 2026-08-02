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
    // emailをそのまま信用しており、任意のメールアドレスを指定するだけで
    // 他人の支払い履歴を閲覧できてしまっていた。
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
