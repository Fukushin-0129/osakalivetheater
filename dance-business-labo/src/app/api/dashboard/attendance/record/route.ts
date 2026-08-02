import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/supabase/require-staff'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const staffError = await requireStaff(supabase)
    if (staffError) return staffError

    const body = await req.json()
    const { lesson_id, student_id, status, notes } = body

    if (!lesson_id || !student_id || !status) {
      return NextResponse.json(
        { error: 'lesson_id, student_id, and status are required' },
        { status: 400 }
      )
    }

    // Create attendance record
    const { data: attendance, error: attendanceError } = await supabase
      .from('attendance')
      .insert([
        {
          lesson_id,
          student_id,
          status,
          notes: notes || null,
          ticket_used: false,
        },
      ])
      .select()

    if (attendanceError) throw attendanceError

    // Only process charges for present status
    if (status !== 'present') {
      return NextResponse.json({ data: attendance?.[0] }, { status: 201 })
    }

    // Get student's subscription status
    const { data: subscription } = await supabase
      .from('student_subscriptions')
      .select('*')
      .eq('student_id', student_id)
      .eq('status', 'active')
      .single()

    let paymentProcessed = false

    // If subscription exists, charge subscription payment
    if (subscription) {
      // Create payment record for subscription
      const { error: paymentError } = await supabase
        .from('student_payments')
        .insert([
          {
            student_id,
            amount: subscription.monthly_price,
            payment_date: new Date().toISOString().split('T')[0],
            payment_type: 'subscription_payment',
            reference_id: subscription.id,
            status: 'completed',
          },
        ])

      if (!paymentError) {
        paymentProcessed = true
      }
    } else {
      // No subscription, try to consume ticket
      // Get active tickets (where used_count < total_count)
      const { data: allTickets } = await supabase
        .from('student_tickets')
        .select('*')
        .eq('student_id', student_id)
        .order('expires_at')

      // Filter tickets with remaining count
      const tickets = (allTickets || []).filter(
        (t) => t.used_count < t.total_count && (!t.expires_at || new Date(t.expires_at) >= new Date())
      )

      if (tickets && tickets.length > 0) {
        const ticket = tickets[0]

        // Update ticket usage
        const { error: updateError } = await supabase
          .from('student_tickets')
          .update({
            used_count: ticket.used_count + 1,
          })
          .eq('id', ticket.id)

        if (!updateError) {
          // Mark attendance as ticket used
          const { error: markError } = await supabase
            .from('attendance')
            .update({ ticket_used: true })
            .eq('id', attendance?.[0]?.id)

          if (!markError) {
            paymentProcessed = true
          }
        }
      }
    }

    return NextResponse.json({
      data: attendance?.[0],
      paymentProcessed,
      message: paymentProcessed
        ? 'Attendance recorded and payment processed'
        : 'Attendance recorded (no subscription or ticket available)',
    })
  } catch (error) {
    console.error('Error recording attendance:', error)
    return NextResponse.json(
      { error: 'Failed to record attendance' },
      { status: 500 }
    )
  }
}
