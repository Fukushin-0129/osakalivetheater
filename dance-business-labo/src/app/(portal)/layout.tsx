import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import StudentPortalNav from '@/components/layout/StudentPortalNav'

export const dynamic = 'force-dynamic'

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <header className="sticky top-0 z-30 bg-indigo-800 text-white shadow-md">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6">
          <div>
            <div className="font-bold">🕺 Dance Labo</div>
            <div className="text-[11px] text-indigo-200">生徒ポータル</div>
          </div>
          <StudentPortalNav placement="header" />
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-5 pb-24 sm:px-6 sm:py-7 md:pb-8">
        {children}
      </main>
      <StudentPortalNav placement="mobile" />
    </div>
  )
}
