'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { CalendarDays, FileText, Home, LogOut, Theater } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const links = [
  { href: '/portal', label: 'ホーム', icon: Home },
  { href: '/portal/reserve', label: '予約・予定', icon: CalendarDays },
  { href: '/portal/records', label: 'カルテ', icon: FileText },
  { href: '/portal/stages', label: '舞台', icon: Theater },
]

export default function StudentPortalNav({ placement }: { placement: 'header' | 'mobile' }) {
  const pathname = usePathname()
  const router = useRouter()

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  if (placement === 'mobile') {
    return (
      <nav aria-label="生徒メニュー" className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(15,23,42,0.08)] backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {links.map(({ href, label, icon: Icon }) => {
            const active = href === '/portal' ? pathname === href : pathname.startsWith(href)
            return (
              <Link key={href} href={href} className={`flex min-h-14 flex-col items-center justify-center gap-1 px-2 text-xs font-medium ${active ? 'text-indigo-700' : 'text-gray-500'}`}>
                <Icon size={20} aria-hidden="true" />
                {label}
              </Link>
            )
          })}
          <button onClick={signOut} className="flex min-h-14 flex-col items-center justify-center gap-1 px-2 text-xs font-medium text-gray-500" aria-label="ログアウト">
            <LogOut size={20} aria-hidden="true" />
            ログアウト
          </button>
        </div>
      </nav>
    )
  }

  return (
    <nav aria-label="生徒メニュー" className="hidden items-center gap-1 md:flex">
      {links.map(({ href, label }) => {
        const active = href === '/portal' ? pathname === href : pathname.startsWith(href)
        return (
          <Link key={href} href={href} className={`rounded-lg px-3 py-2 text-sm transition-colors ${active ? 'bg-indigo-700 text-white' : 'text-indigo-100 hover:bg-indigo-700'}`}>
            {label}
          </Link>
        )
      })}
      <button onClick={signOut} className="ml-2 flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-indigo-100 hover:bg-indigo-700" aria-label="ログアウト">
        <LogOut size={16} /> ログアウト
      </button>
    </nav>
  )
}
