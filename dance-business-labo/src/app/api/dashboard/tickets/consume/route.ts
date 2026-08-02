import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const getSupabase = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

// 出席が「出席」になった際に呼ぶ。スタンプカード（回数券）を1回分消化し、
// 4回目（total_countに到達）なら次のカードを自動発行して入金確認待ちの
// student_payments を作成する。月謝（サブスク）中の生徒は対象外。
export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase()
    const body = await req.json()
    const { student_id, lesson_date } = body

    if (!student_id) {
      return NextResponse.json({ error: 'student_id is required' }, { status: 400 })
    }
    const date = lesson_date || new Date().toISOString().split('T')[0]

    const { data: subscription } = await supabase
      .from('student_subscriptions')
      .select('id')
      .eq('student_id', student_id)
      .eq('status', 'active')
      .maybeSingle()

    if (subscription) {
      return NextResponse.json({ consumed: false, reason: 'has_active_subscription' })
    }

    const { data: allTickets } = await supabase
      .from('student_tickets')
      .select('*')
      .eq('student_id', student_id)
      .order('expires_at')

    const tickets = (allTickets || []).filter(
      (t) => t.used_count < t.total_count && (!t.expires_at || new Date(t.expires_at) >= new Date())
    )

    if (tickets.length === 0) {
      return NextResponse.json({ consumed: false, reason: 'no_active_ticket' })
    }

    const ticket = tickets[0]
    const newUsedCount = ticket.used_count + 1

    const { error: updateError } = await supabase
      .from('student_tickets')
      .update({ used_count: newUsedCount })
      .eq('id', ticket.id)

    if (updateError) throw updateError

    let cardCompleted = false
    let pendingPaymentId: string | null = null

    if (newUsedCount >= ticket.total_count) {
      cardCompleted = true

      const { data: ticketType } = await supabase
        .from('ticket_types')
        .select('*')
        .eq('id', ticket.ticket_type_id)
        .single()

      if (ticketType) {
        const expiresAt = new Date(date)
        expiresAt.setDate(expiresAt.getDate() + ticketType.valid_days)

        const { data: newTicket, error: newTicketError } = await supabase
          .from('student_tickets')
          .insert({
            student_id,
            ticket_type_id: ticketType.id,
            purchased_at: date,
            expires_at: expiresAt.toISOString().split('T')[0],
            total_count: ticketType.total_count,
            used_count: 0,
          })
          .select()
          .single()

        if (!newTicketError && newTicket) {
          const { data: payment } = await supabase
            .from('student_payments')
            .insert({
              student_id,
              amount: ticketType.price,
              payment_date: date,
              payment_type: 'ticket_purchase',
              reference_id: newTicket.id,
              status: 'pending',
              notes: `${ticketType.name} 自動更新（要入金確認）`,
            })
            .select()
            .single()

          pendingPaymentId = payment?.id ?? null
        }
      }
    }

    return NextResponse.json({ consumed: true, cardCompleted, pendingPaymentId })
  } catch (error) {
    console.error('Error consuming ticket:', error)
    return NextResponse.json({ error: 'Failed to consume ticket' }, { status: 500 })
  }
}
