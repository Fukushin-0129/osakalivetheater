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
    const { subscription_type_id } = body

    if (!subscription_type_id) {
      return NextResponse.json(
        { error: 'subscription_type_id is required' },
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

    // Get subscription type
    const { data: subscriptionType, error: subError } = await supabase
      .from('subscription_types')
      .select('*')
      .eq('id', subscription_type_id)
      .single()

    if (subError || !subscriptionType) {
      return NextResponse.json(
        { error: 'Subscription type not found' },
        { status: 404 }
      )
    }

    // Check if student already has active subscription
    const { data: existingSubscription } = await supabase
      .from('student_subscriptions')
      .select('*')
      .eq('student_id', student_id)
      .eq('status', 'active')
      .single()

    if (existingSubscription) {
      return NextResponse.json(
        { error: 'Student already has active subscription' },
        { status: 400 }
      )
    }

    // Create Stripe product if not exists
    const products = await stripe.products.list({
      limit: 100,
    })

    let productId: string
    const existingProduct = products.data.find(
      (p) => p.metadata?.subscription_type_id === subscription_type_id
    )

    if (existingProduct) {
      productId = existingProduct.id
    } else {
      const createdProduct = await stripe.products.create({
        name: subscriptionType.name,
        type: 'service',
        metadata: {
          subscription_type_id,
        },
      })
      productId = createdProduct.id
    }

    // Create price for monthly billing
    const prices = await stripe.prices.list({
      product: productId,
      type: 'recurring',
    })

    let priceId: string

    if (prices.data.length === 0) {
      const price = await stripe.prices.create({
        product: productId,
        unit_amount: subscriptionType.monthly_price,
        currency: 'jpy',
        recurring: {
          interval: 'month',
          interval_count: 1,
        },
        metadata: {
          subscription_type_id,
        },
      })
      priceId = price.id
    } else {
      priceId = prices.data[0].id
    }

    // Create Stripe checkout session for subscription
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/portal/billing?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/portal/billing?canceled=true`,
      customer_email: student.email || undefined,
      metadata: {
        student_id,
        subscription_type_id,
      },
    })

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    })
  } catch (error) {
    console.error('Error creating subscription session:', error)
    return NextResponse.json(
      { error: 'Failed to create subscription session' },
      { status: 500 }
    )
  }
}
