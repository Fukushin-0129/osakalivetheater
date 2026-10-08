import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()

  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: student, error } = await admin
    .from('students')
    .select('id')
    .eq('email', user.email)
    // Duplicate student rows can exist during data cleanup. Any match means this is a student account.
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('Failed to determine account destination:', error)
    return NextResponse.json({ error: 'Unable to load account' }, { status: 500 })
  }

  return NextResponse.json({ destination: student ? '/portal' : '/' })
}
