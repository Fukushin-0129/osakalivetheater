import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const studentId = searchParams.get('student_id')
  const redirectTo = searchParams.get('redirect') || '/portal'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user?.id && studentId) {
    const admin = createAdminClient()
    const { data: access } = await admin
      .from('portal_access')
      .select('student_id')
      .eq('user_id', user.id)
      .eq('student_id', studentId)
      .maybeSingle()

    if (access) {
      const cookieStore = await cookies()
      cookieStore.set('portal_student_id', studentId, {
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
        sameSite: 'lax',
      })
    }
  }

  return NextResponse.redirect(new URL(redirectTo, origin))
}
