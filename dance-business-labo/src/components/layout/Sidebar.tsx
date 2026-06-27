'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard,
  Users,
  Calendar,
  ClipboardCheck,
  Ticket,
  FileText,
  TrendingUp,
  LogOut,
  Menu,
  X,
  BookOpen,
  CreditCard,
} from 'lucide-react'
import { useState } from 'react'

const navItems = [
  { href: '/', label: 'ダッシュボード', icon: LayoutDashboard },
  { href: '/students', label: '生徒管理', icon: Users },
  { href: '/lessons', label: 'レッスン', icon: Calendar },
  { href: '/curriculum', label: 'カリキュラム', icon: BookOpen },
  { href: '/attendance', label: '出席管理', icon: ClipboardCheck },
  { href: '/subscriptions', label: '月謝管理', icon: CreditCard },
  { href: '/tickets', label: 'チケット', icon: Ticket },
  { href: '/records', label: 'カルテ', icon: FileText },
  { href: '/finance', label: '損益管理', icon: TrendingUp },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const NavContent = () => (
    <>
      <div className="p-4 border-b border-indigo-700">
        <div className="text-white font-bold text-lg">🕺 Dance Labo</div>
        <div className="text-indigo-300 text-xs mt-0.5">タップダンス教室管理</div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-indigo-700 text-white'
                  : 'text-indigo-200 hover:bg-indigo-700/50 hover:text-white'
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="p-3 border-t border-indigo-700">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-indigo-200 hover:bg-indigo-700/50 hover:text-white transition-colors"
        >
          <LogOut size={18} />
          ログアウト
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 bg-indigo-800 min-h-screen fixed top-0 left-0 z-30">
        <NavContent />
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-indigo-800 flex items-center justify-between px-4 py-3">
        <div className="text-white font-bold">🕺 Dance Labo</div>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="text-white">
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-30 flex">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative flex flex-col w-56 bg-indigo-800 h-full pt-14">
            <NavContent />
          </aside>
        </div>
      )}
    </>
  )
}
