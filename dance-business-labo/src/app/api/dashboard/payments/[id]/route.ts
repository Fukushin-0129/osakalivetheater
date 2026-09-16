import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/supabase/require-staff'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const staffError = await requireStaff(supabase)
    if (staffError) return staffError

    const { id } = await params
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
    const supabase = await createClient()
    const staffError = await requireStaff(supabase)
    if (staffError) return staffError

    const { id } = await params
    const body = await req.json()
    const { status, amount, payment_date, payment_type, notes, subsidy_amount, subsidy_received } = body

    const { data: before } = await supabase
      .from('student_payments')
      .select('*, students(name)')
      .eq('id', id)
      .single()

    const update: Record<string, unknown> = {
      status,
      amount,
      notes,
      updated_at: new Date().toISOString(),
    }
    if (payment_date !== undefined) update.payment_date = payment_date
    if (payment_type !== undefined) update.payment_type = payment_type
    if (subsidy_amount !== undefined) update.subsidy_amount = subsidy_amount
    if (subsidy_received !== undefined) update.subsidy_received = subsidy_received

    const { data, error } = await supabase
      .from('student_payments')
      .update(update)
      .eq('id', id)
      .select()

    if (error) throw error

    const payment = data?.[0]
    const studentName = (before?.students as { name: string } | null)?.name ?? ''

    if (payment && before) {
      const { data: existingTxns } = await supabase
        .from('transactions')
        .select('id')
        .ilike('description', `%[ref:${payment.id}]%`)

      const wasCompleted = before.status === 'completed'
      const isCompleted = payment.status === 'completed'

      if (isCompleted) {
        const category = PAYMENT_TYPE_CATEGORY[payment.payment_type] ?? 'その他収入'
        const description = `${category}${studentName ? `（${studentName}）` : ''} [ref:${payment.id}]`
        if (existingTxns && existingTxns.length > 0) {
          // 既に計上済みなら、金額・日付・種別の変更を反映する
          await supabase.from('transactions').update({
            transaction_date: payment.payment_date,
            category,
            amount: payment.amount,
            description,
          }).eq('id', existingTxns[0].id)
        } else if (!wasCompleted) {
          // pending/failed → completed の遷移で新規計上
          await supabase.from('transactions').insert([{
            transaction_date: payment.payment_date,
            type: 'income',
            category,
            amount: payment.amount,
            description,
          }])
        }
      } else if (wasCompleted && existingTxns && existingTxns.length > 0) {
        // completed から取り消された場合は、計上した収入も取り消す
        await supabase.from('transactions').delete().eq('id', existingTxns[0].id)
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
    const supabase = await createClient()
    const staffError = await requireStaff(supabase)
    if (staffError) return staffError

    const { id } = await params

    await supabase.from('transactions').delete().ilike('description', `%[ref:${id}]%`)

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
