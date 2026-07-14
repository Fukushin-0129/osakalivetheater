import { stripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const getSupabase = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

// Stripeの決済を損益管理（transactions）にも収入として反映する。
// Webhookは再送されることがあるため、同じ参照IDが既に記録済みなら重複登録しない。
async function recordIncomeTransaction(
  supabase: ReturnType<typeof getSupabase>,
  {
    date,
    category,
    amount,
    referenceId,
    note,
  }: { date: string; category: string; amount: number; referenceId: string; note?: string }
) {
  const description = `Stripe決済${note ? `（${note}）` : ''} [ref:${referenceId}]`

  const { data: existing } = await supabase
    .from('transactions')
    .select('id')
    .ilike('description', `%[ref:${referenceId}]%`)
    .limit(1)

  if (existing && existing.length > 0) return

  await supabase.from('transactions').insert([
    {
      transaction_date: date,
      type: 'income',
      category,
      amount,
      description,
    },
  ])
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const signature = req.headers.get('stripe-signature')

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      )
    }

    let event

    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      )
    } catch (error) {
      console.error('Webhook signature verification failed:', error)
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      )
    }

    const supabase = getSupabase()

    // Handle checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any
      const studentId = session.metadata?.student_id
      const ticketTypeId = session.metadata?.ticket_type_id
      const subscriptionTypeId = session.metadata?.subscription_type_id
      const type = session.metadata?.type

      if (!studentId) {
        console.error('Missing student_id in metadata')
        return NextResponse.json(
          { error: 'Missing student_id in metadata' },
          { status: 400 }
        )
      }

      // Handle ticket purchase
      if (type === 'ticket_purchase' && ticketTypeId) {
        // Get ticket type to get expiry date
        const { data: ticketType } = await supabase
          .from('ticket_types')
          .select('*')
          .eq('id', ticketTypeId)
          .single()

        if (!ticketType) {
          console.error('Ticket type not found')
          return NextResponse.json(
            { error: 'Ticket type not found' },
            { status: 404 }
          )
        }

        // Create student ticket
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + ticketType.valid_days)

        const { error: ticketError } = await supabase
          .from('student_tickets')
          .insert([
            {
              student_id: studentId,
              ticket_type_id: ticketTypeId,
              purchased_at: new Date().toISOString().split('T')[0],
              expires_at: expiresAt.toISOString().split('T')[0],
              total_count: ticketType.total_count,
              used_count: 0,
            },
          ])

        if (ticketError) {
          console.error('Error creating student ticket:', ticketError)
          return NextResponse.json(
            { error: 'Failed to create student ticket' },
            { status: 500 }
          )
        }

        // Create payment record
        await supabase.from('student_payments').insert([
          {
            student_id: studentId,
            amount: ticketType.price,
            payment_date: new Date().toISOString().split('T')[0],
            payment_type: 'ticket_purchase',
            reference_id: session.id,
            status: 'completed',
          },
        ])

        await recordIncomeTransaction(supabase, {
          date: new Date().toISOString().split('T')[0],
          category: 'チケット販売',
          amount: ticketType.price,
          referenceId: session.id,
          note: ticketType.name,
        })
      }
      // Handle trial lesson payment
      else if (type === 'trial_lesson_payment') {
        const amount = (session.amount_total ?? 0) / 100

        await supabase.from('student_payments').insert([
          {
            student_id: studentId,
            amount,
            payment_date: new Date().toISOString().split('T')[0],
            payment_type: 'trial_lesson_payment',
            reference_id: session.id,
            status: 'completed',
          },
        ])

        await recordIncomeTransaction(supabase, {
          date: new Date().toISOString().split('T')[0],
          category: '体験レッスン収入',
          amount,
          referenceId: session.id,
          note: '体験レッスン',
        })
      }
      // Handle subscription start
      else if (subscriptionTypeId) {
        const { data: subscriptionType } = await supabase
          .from('subscription_types')
          .select('*')
          .eq('id', subscriptionTypeId)
          .single()

        if (!subscriptionType) {
          console.error('Subscription type not found')
          return NextResponse.json(
            { error: 'Subscription type not found' },
            { status: 404 }
          )
        }

        // Calculate next payment date (30 days from now)
        const nextPaymentDate = new Date()
        nextPaymentDate.setDate(nextPaymentDate.getDate() + 30)

        // Create student subscription
        const { error: subError } = await supabase
          .from('student_subscriptions')
          .insert([
            {
              student_id: studentId,
              subscription_type_id: subscriptionTypeId,
              start_date: new Date().toISOString().split('T')[0],
              status: 'active',
              monthly_price: subscriptionType.monthly_price,
              billing_day: new Date().getDate(),
              next_payment_date: nextPaymentDate.toISOString().split('T')[0],
            },
          ])

        if (subError) {
          console.error('Error creating subscription:', subError)
          return NextResponse.json(
            { error: 'Failed to create subscription' },
            { status: 500 }
          )
        }

        // Create initial payment record
        await supabase.from('student_payments').insert([
          {
            student_id: studentId,
            amount: subscriptionType.monthly_price,
            payment_date: new Date().toISOString().split('T')[0],
            payment_type: 'subscription_payment',
            reference_id: session.id,
            status: 'completed',
          },
        ])

        await recordIncomeTransaction(supabase, {
          date: new Date().toISOString().split('T')[0],
          category: 'レッスン収入',
          amount: subscriptionType.monthly_price,
          referenceId: session.id,
          note: subscriptionType.name,
        })
      }
    }

    // Handle invoice.payment_succeeded event (recurring payments)
    if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object as any

      if (invoice.subscription) {
        // Get subscription details from Stripe
        const subscription = await stripe.subscriptions.retrieve(
          invoice.subscription as string
        )

        const studentId = subscription.metadata?.student_id
        const subscriptionTypeId = subscription.metadata?.subscription_type_id

        if (studentId && subscriptionTypeId) {
          const paymentDate = new Date(invoice.created * 1000).toISOString().split('T')[0]
          const amount = invoice.amount_paid / 100 // Convert from cents

          // Create payment record for recurring payment
          await supabase.from('student_payments').insert([
            {
              student_id: studentId,
              amount,
              payment_date: paymentDate,
              payment_type: 'subscription_payment',
              reference_id: invoice.id,
              status: 'completed',
            },
          ])

          await recordIncomeTransaction(supabase, {
            date: paymentDate,
            category: 'レッスン収入',
            amount,
            referenceId: invoice.id,
            note: '月謝（自動更新）',
          })

          // Update next payment date
          await supabase
            .from('student_subscriptions')
            .update({
              next_payment_date: new Date(invoice.next_payment_attempt! * 1000)
                .toISOString()
                .split('T')[0],
            })
            .eq('student_id', studentId)
            .eq('subscription_type_id', subscriptionTypeId)
            .eq('status', 'active')
        }
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}
