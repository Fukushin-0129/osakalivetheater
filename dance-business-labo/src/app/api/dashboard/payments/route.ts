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
