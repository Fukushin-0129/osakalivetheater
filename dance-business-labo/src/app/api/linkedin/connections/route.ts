import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const status = request.nextUrl.searchParams.get('status')

    let query = supabase.from('linkedin_connections').select('*')

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query.order('request_received_at', {
      ascending: false,
    })

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching connections:', error)
    return NextResponse.json(
      { error: 'Failed to fetch connections' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      linkedin_id,
      first_name,
      last_name,
      email,
      headline,
      profile_url,
      picture_url,
    } = body

    if (!linkedin_id || !first_name || !last_name) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('linkedin_connections')
      .insert({
        linkedin_id,
        first_name,
        last_name,
        email: email || null,
        headline: headline || null,
        profile_url: profile_url || null,
        picture_url: picture_url || null,
        request_received_at: new Date().toISOString(),
        status: 'pending',
      })
      .select()

    if (error) throw error

    return NextResponse.json(data[0], { status: 201 })
  } catch (error) {
    console.error('Error creating connection:', error)
    return NextResponse.json(
      { error: 'Failed to create connection' },
      { status: 500 }
    )
  }
}
