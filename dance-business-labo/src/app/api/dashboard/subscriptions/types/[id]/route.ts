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
      .from('subscription_types')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error fetching subscription type:', error)
    return NextResponse.json(
      { error: 'Subscription type not found' },
      { status: 404 }
    )
  }
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
    const { name, monthly_price, max_lessons_per_month } = body

    const { data, error } = await supabase
      .from('subscription_types')
      .update({
        name,
        monthly_price,
        max_lessons_per_month,
      })
      .eq('id', id)
      .select()

    if (error) throw error

    return NextResponse.json({ data: data?.[0] })
  } catch (error) {
    console.error('Error updating subscription type:', error)
    return NextResponse.json(
      { error: 'Failed to update subscription type' },
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
    const { error } = await supabase
      .from('subscription_types')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting subscription type:', error)
    return NextResponse.json(
      { error: 'Failed to delete subscription type' },
      { status: 500 }
    )
  }
}
