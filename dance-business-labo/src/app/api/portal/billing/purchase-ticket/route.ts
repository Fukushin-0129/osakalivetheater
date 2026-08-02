import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { ticket_type_id } = body

    if (!ticket_type_id) {
      return NextResponse.json(
        { error: 'ticket_type_id is required' },
        { status: 400 }
      )
    }

    // student_id はリクエストボディからではなく、ログイン中のセッション（メール）から
    // 特定する。クライアントが指定したIDを信用すると、他の生徒になりすませてしまう。
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, email')
      .eq('email', user.email ?? '')
      .single()

    if (studentError || !student) {
      return NextResponse.json(
        { error: 'Student not found' },
        { status: 404 }
      )
    }
    const student_id = student.id

    // Get ticket type
    const { data: ticketType, error: ticketError } = await supabase
      .from('ticket_types')
      .select('*')
      .eq('id', ticket_type_id)
      .single()

    if (ticketError || !ticketType) {
      return NextResponse.json(
        { error: 'Ticket type not found' },
        { status: 404 }
      )
    }

    // Create Stripe checkout session for ticket purchase
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'jpy',
            product_data: {
              name: ticketType.name,
              description: `${ticketType.total_count}回のレッスンチケット`,
            },
            unit_amount: ticketType.price,
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/portal/billing?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/portal/billing?canceled=true`,
      customer_email: student.email || undefined,
      metadata: {
        student_id,
        ticket_type_id,
        type: 'ticket_purchase',
      },
    })

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    })
  } catch (error) {
    console.error('Error creating checkout session:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
