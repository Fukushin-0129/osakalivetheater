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

    const { data: ticketTypes, error } = await supabase
      .from('ticket_types')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({
      data: ticketTypes || [],
    })
  } catch (error) {
    console.error('Error fetching ticket types:', error)
    return NextResponse.json(
      { error: 'Failed to fetch ticket types' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase()
    const body = await req.json()
    const { name, total_count, price, valid_days } = body

    if (!name || !total_count || !price) {
      return NextResponse.json(
        { error: 'name, total_count, and price are required' },
        { status: 400 }
      )
    }

    const { data: ticketType, error } = await supabase
      .from('ticket_types')
      .insert([
        {
          name,
          total_count,
          price,
          valid_days: valid_days || 180,
        },
      ])
      .select()

    if (error) throw error

    return NextResponse.json({ data: ticketType?.[0] }, { status: 201 })
  } catch (error) {
    console.error('Error creating ticket type:', error)
    return NextResponse.json(
      { error: 'Failed to create ticket type' },
      { status: 500 }
    )
  }
}
