import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const getSupabase = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('student_payments')
      .select(
        `
        *,
        students(id, name, email)
      `
      )
      .eq('id', id)
      .single()

    if (error) throw error

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error fetching payment:', error)
    return NextResponse.json(
      { error: 'Payment not found' },
      { status: 404 }
    )
  }
}

const PAYMENT_TYPE_CATEGORY: Record<string, string> = {
  ticket_purchase: 'チケット販売',
  subscription_payment: 'レッスン収入',
  trial_lesson_payment: '体験レッスン収入',
  manual: 'その他収入',
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = getSupabase()
    const body = await req.json()
    const { status, amount, notes } = body

    const { data: before } = await supabase
      .from('student_payments')
      .select('*, students(name)')
      .eq('id', id)
      .single()

    const { data, error } = await supabase
      .from('student_payments')
      .update({
        status,
        amount,
        notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()

    if (error) throw error

    const payment = data?.[0]

    // 入金確認（pending → completed）のタイミングで損益管理（transactions）へ収入を計上する。
    if (payment && before && before.status !== 'completed' && payment.status === 'completed') {
      const category = PAYMENT_TYPE_CATEGORY[payment.payment_type] ?? 'その他収入'
      const studentName = (before.students as { name: string } | null)?.name ?? ''
      const description = `${category}${studentName ? `（${studentName}）` : ''} [ref:${payment.id}]`

      const { data: existing } = await supabase
        .from('transactions')
        .select('id')
        .ilike('description', `%[ref:${payment.id}]%`)
        .limit(1)

      if (!existing || existing.length === 0) {
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
    }

    return NextResponse.json({ data: payment })
  } catch (error) {
    console.error('Error updating payment:', error)
    return NextResponse.json(
      { error: 'Failed to update payment' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = getSupabase()
    const { error } = await supabase
      .from('student_payments')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting payment:', error)
    return NextResponse.json(
      { error: 'Failed to delete payment' },
      { status: 500 }
    )
  }
}
