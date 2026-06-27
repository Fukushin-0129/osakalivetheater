import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { SubscriptionType } from '@/types/database'

const getSupabase = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

export async function GET() {
  try {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('subscription_types')
      .select('*')
      .order('name')

    if (error) throw error

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error fetching subscription types:', error)
    return NextResponse.json(
      { error: 'Failed to fetch subscription types' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase()
    const body = await req.json()
    const { name, monthly_price, max_lessons_per_month } = body

    if (!name || !monthly_price) {
      return NextResponse.json(
        { error: 'name and monthly_price are required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('subscription_types')
      .insert([
        {
          name,
          monthly_price,
          max_lessons_per_month: max_lessons_per_month || null,
        },
      ])
      .select()

    if (error) throw error

    return NextResponse.json({ data: data?.[0] }, { status: 201 })
  } catch (error) {
    console.error('Error creating subscription type:', error)
    return NextResponse.json(
      { error: 'Failed to create subscription type' },
      { status: 500 }
    )
  }
}
