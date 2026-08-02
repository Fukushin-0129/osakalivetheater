import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/supabase/require-staff'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const staffError = await requireStaff(supabase)
    if (staffError) return staffError

    const searchParams = req.nextUrl.searchParams
    const studentId = searchParams.get('student_id')
    const status = searchParams.get('status')

    let query = supabase
      .from('student_subscriptions')
      .select(
        `
        *,
        subscription_types(*),
        students(id, name, email)
      `
      )

    if (studentId) {
      query = query.eq('student_id', studentId)
    }

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query.order('created_at', {
      ascending: false,
    })

    if (error) throw error

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error fetching subscriptions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch subscriptions' },
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
      subscription_type_id,
      start_date,
      billing_day,
      end_date,
    } = body

    if (!student_id || !subscription_type_id || !start_date) {
      return NextResponse.json(
        {
          error:
            'student_id, subscription_type_id, and start_date are required',
        },
        { status: 400 }
      )
    }

    // Get subscription type to get monthly_price
    const { data: typeData, error: typeError } = await supabase
      .from('subscription_types')
      .select('monthly_price')
      .eq('id', subscription_type_id)
      .single()

    if (typeError || !typeData) {
      return NextResponse.json(
        { error: 'Subscription type not found' },
        { status: 404 }
      )
    }

    // Calculate next_payment_date
    const startDate = new Date(start_date)
    const nextPaymentDate = new Date(startDate)
    nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1)

    const { data, error } = await supabase
      .from('student_subscriptions')
      .insert([
        {
          student_id,
          subscription_type_id,
          start_date,
          end_date: end_date || null,
          status: 'active',
          monthly_price: typeData.monthly_price,
          billing_day: billing_day || 1,
          next_payment_date: nextPaymentDate.toISOString().split('T')[0],
        },
      ])
      .select()

    if (error) throw error

    return NextResponse.json({ data: data?.[0] }, { status: 201 })
  } catch (error) {
    console.error('Error creating subscription:', error)
    return NextResponse.json(
      { error: 'Failed to create subscription' },
      { status: 500 }
    )
  }
}
