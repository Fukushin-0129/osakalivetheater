import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/supabase/require-staff'
import { NextRequest, NextResponse } from 'next/server'

const PAYMENT_TYPE_CATEGORY: Record<string, string> = {
  ticket_purchase: 'チケット販売',
  subscription_payment: 'レッスン収入',
  trial_lesson_payment: '体験レッスン収入',
  manual: 'その他収入',
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const staffError = await requireStaff(supabase)
    if (staffError) return staffError

    const searchParams = req.nextUrl.searchParams
    const studentId = searchParams.get('student_id')
    const status = searchParams.get('status')

    let query = supabase
      .from('student_payments')
      .select(
        `
        *,
        students(id, name, email)
      `
      )

    if (studentId) {
      query = query.eq('student_id', studentId)
    }

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query.order('payment_date', {
      ascending: false,
    })

    if (error) throw error

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error fetching payments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch payments' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const staffError = await requireStaff(supabase)
    if (staffError) return staffError

    const body = await req.json()
    const {
      student_id,
      amount,
      payment_date,
      payment_type,
      reference_id,
      status,
      notes,
      subsidy_amount,
      subsidy_received,
    } = body

    if (!student_id || !amount || !payment_date || !payment_type) {
      return NextResponse.json(
        {
          error:
            'student_id, amount, payment_date, and payment_type are required',
        },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('student_payments')
      .insert([
        {
          student_id,
          amount,
          payment_date,
          payment_type,
          reference_id: reference_id || null,
          status: status || 'completed',
          notes: notes || null,
          subsidy_amount: subsidy_amount || 0,
          subsidy_received: subsidy_received || false,
        },
      ])
      .select('*, students(name)')

    if (error) throw error

    const payment = data?.[0]

    // 完済で作成された場合は、その場で損益管理（transactions）へ収入を計上する。
    if (payment && payment.status === 'completed') {
      const category = PAYMENT_TYPE_CATEGORY[payment.payment_type] ?? 'その他収入'
      const studentName = (payment.students as { name: string } | null)?.name ?? ''
      const description = `${category}${studentName ? `（${studentName}）` : ''} [ref:${payment.id}]`

      await supabase.from('transactions').insert([
        {
          transaction_date: payment.payment_date,
          type: 'income',
          category,
          amount: payment.amount,
          description,
        },
      ])
    }

    return NextResponse.json({ data: payment }, { status: 201 })
  } catch (error) {
    console.error('Error creating payment:', error)
    return NextResponse.json(
      { error: 'Failed to create payment' },
      { status: 500 }
    )
  }
}
