import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import StudentPortalNav from '@/components/layout/StudentPortalNav'
import { getAuthenticatedPortalStudent } from '@/lib/portal/auth'
import { Users } from 'lucide-react'
import { Shippori_Mincho } from 'next/font/google'

const mincho = Shippori_Mincho({ weight: ['400', '600', '800'], subsets: ['latin'], variable: '--font-mincho' })

export const dynamic = 'force-dynamic'

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { student, students } = await getAuthenticatedPortalStudent()

  return (
    <div className={`${mincho.variable} portal-root min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50`}>
      <style>{`
        .portal-root h1,
        .portal-root h2 {
          font-family: var(--font-mincho), serif;
          letter-spacing: 0.03em;
        }
      `}</style>
      <header className="sticky top-0 z-30 bg-indigo-800 text-white shadow-md">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6">
          <div>
            <div className="font-bold" style={{ fontFamily: 'var(--font-mincho), serif' }}>🕺 Dance Labo</div>
            <div className="text-[11px] text-indigo-200">生徒ポータル</div>
          </div>
          <StudentPortalNav placement="header" />
        </div>
      </header>

      {students.length > 1 && (
        <div className="sticky top-14 z-20 bg-indigo-700/95 backdrop-blur text-white">
          <div className="mx-auto flex max-w-4xl items-center gap-2 overflow-x-auto px-4 py-2 sm:px-6 scrollbar-none">
            <Users size={14} className="flex-shrink-0 text-indigo-200" />
            {students.map(s => (
              <a
                key={s.id}
                href={`/api/portal/select-student?student_id=${s.id}`}
                className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  student?.id === s.id ? 'bg-white text-indigo-700' : 'bg-indigo-600/60 text-indigo-100 hover:bg-indigo-600'
                }`}
              >
                {s.name}
              </a>
            ))}
          </div>
        </div>
      )}

      <main className="mx-auto max-w-4xl px-4 py-5 pb-24 sm:px-6 sm:py-7 md:pb-8">
        {children}
      </main>
      <StudentPortalNav placement="mobile" />
    </div>
  )
}
