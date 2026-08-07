import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PortalLogoutButton from '@/components/PortalLogoutButton'

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <header className="bg-indigo-800 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <div className="font-bold text-lg">🕺 Dance Labo</div>
        <nav className="flex items-center gap-1">
          <Link href="/portal" className="px-3 py-1.5 rounded-lg text-sm text-indigo-200 hover:bg-indigo-700 hover:text-white transition-colors">
            ホーム
          </Link>
          <Link href="/portal/records" className="px-3 py-1.5 rounded-lg text-sm text-indigo-200 hover:bg-indigo-700 hover:text-white transition-colors">
            マイカルテ
          </Link>
          <Link href="/portal/reserve" className="px-3 py-1.5 rounded-lg text-sm text-indigo-200 hover:bg-indigo-700 hover:text-white transition-colors">
            予約
          </Link>
          <Link href="/portal/billing" className="px-3 py-1.5 rounded-lg text-sm text-indigo-200 hover:bg-indigo-700 hover:text-white transition-colors">
            料金・支払い
          </Link>
          <PortalLogoutButton />
        </nav>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
