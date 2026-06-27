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
    const isActive = searchParams.get('is_active')

    let query = supabase.from('students').select('*').order('name')

    if (isActive === 'true') {
      query = query.eq('is_active', true)
    } else if (isActive === 'false') {
      query = query.eq('is_active', false)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error fetching students:', error)
    return NextResponse.json(
      { error: 'Failed to fetch students' },
      { status: 500 }
    )
  }
}
