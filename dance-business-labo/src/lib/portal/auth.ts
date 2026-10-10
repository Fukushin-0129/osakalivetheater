import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function getAuthenticatedPortalStudent() {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()

  if (!user?.email) return { user: null, student: null, admin: null }

  const admin = createAdminClient()
  const { data: student, error } = await admin
    .from('students')
    .select('id, name, name_kana, email, avatar_url, joined_at')
    .eq('email', user.email)
    .maybeSingle()

  if (error) {
    console.error('Failed to find portal student:', error)
    return { user, student: null, admin: null }
  }

  return { user, student, admin }
}
