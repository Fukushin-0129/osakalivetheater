'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { LogOut, ChevronDown } from 'lucide-react'

export default function StudentHeader() {
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userName, setUserName] = useState<string>('生徒')
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        setUserEmail(user.email || null)
        // メールアドレスから名前を取得（簡略版：ローカルパート）
        if (user.email) {
          const name = user.email.split('@')[0]
          setUserName(name)
        }
      }
    }

    fetchUser()
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header className="fixed top-0 left-0 right-0 bg-indigo-600 text-white h-16 flex items-center justify-between px-6 shadow-lg z-50">
      <div className="flex items-center gap-3">
        <div className="text-2xl">🕺</div>
        <div>
          <h1 className="text-xl font-bold">Dance Business Labo</h1>
          <p className="text-xs text-indigo-100">生徒ポータル</p>
        </div>
      </div>

      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
        >
          <div className="text-right">
            <p className="text-sm font-semibold">{userName}</p>
            <p className="text-xs text-indigo-100">{userEmail}</p>
          </div>
          <ChevronDown size={18} className={`transition ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* ドロップダウンメニュー */}
        {isOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white text-gray-800 rounded-lg shadow-xl py-1 z-10">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100 transition text-left"
            >
              <LogOut size={18} />
              <span>ログアウト</span>
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
