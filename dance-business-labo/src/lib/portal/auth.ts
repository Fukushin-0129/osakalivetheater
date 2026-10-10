import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'

const SELECTED_STUDENT_COOKIE = 'portal_student_id'

export async function getAuthenticatedPortalStudent() {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()

  if (!user?.id) return { user: null, student: null, students: [], admin: null }

  const admin = createAdminClient()
  const { data: links, error } = await admin
    .from('portal_access')
    .select('students(id, name, name_kana, email, avatar_url, joined_at)')
    .eq('user_id', user.id)

  if (error) {
    console.error('Failed to find portal students:', error)
    return { user, student: null, students: [], admin: null }
  }

  type StudentRow = { id: string; name: string; name_kana: string | null; email: string | null; avatar_url: string | null; joined_at: string | null }
  const students = ((links ?? []) as unknown as { students: StudentRow | null }[])
    .map(l => l.students)
    .filter((s): s is StudentRow => !!s)
    .sort((a, b) => a.name.localeCompare(b.name, 'ja'))

  if (students.length === 0) return { user, student: null, students: [], admin: null }

  const cookieStore = await cookies()
  const selectedId = cookieStore.get(SELECTED_STUDENT_COOKIE)?.value
  const student = students.find(s => s.id === selectedId) ?? students[0]

  return { user, student, students, admin }
}
