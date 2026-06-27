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
    const supabase = getSupabase()
    const body = await req.json()
    const {
      student_id,
      amount,
      payment_date,
      payment_type,
      reference_id,
      status,
      notes,
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
        },
      ])
      .select()

    if (error) throw error

    return NextResponse.json({ data: data?.[0] }, { status: 201 })
  } catch (error) {
    console.error('Error creating payment:', error)
    return NextResponse.json(
      { error: 'Failed to create payment' },
      { status: 500 }
    )
  }
}
