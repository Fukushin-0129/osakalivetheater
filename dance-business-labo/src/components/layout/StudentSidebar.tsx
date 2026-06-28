'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, CreditCard, Calendar, BookOpen, User } from 'lucide-react'

export default function StudentSidebar() {
  const pathname = usePathname()

  const isActive = (path: string) => pathname === path

  return (
    <aside className="w-64 bg-white border-r border-gray-200 fixed left-0 top-16 bottom-0 overflow-y-auto">
      <nav className="p-6 space-y-8">
        {/* ホーム */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase mb-3">📋 ホーム</p>
          <ul className="space-y-2">
            <li>
              <Link
                href="/student"
                className={`flex items-center gap-3 px-4 py-2 rounded-lg transition ${
                  isActive('/student')
                    ? 'bg-indigo-50 text-indigo-600 font-semibold'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <LayoutDashboard size={18} />
                <span>ダッシュボード</span>
              </Link>
            </li>
          </ul>
        </div>

        {/* 支払い管理 */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase mb-3">💳 支払い管理</p>
          <ul className="space-y-2">
            <li>
              <Link
                href="/student/billing"
                className={`flex items-center gap-3 px-4 py-2 rounded-lg transition ${
                  isActive('/student/billing')
                    ? 'bg-indigo-50 text-indigo-600 font-semibold'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <CreditCard size={18} />
                <span>月謝・チケット</span>
              </Link>
            </li>
            <li>
              <Link
                href="/student/billing#history"
                className="flex items-center gap-3 px-4 py-2 text-sm text-gray-600 hover:text-indigo-600 rounded-lg hover:bg-gray-50 transition"
              >
                <span className="ml-9">支払い履歴</span>
              </Link>
            </li>
          </ul>
        </div>

        {/* レッスン */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase mb-3">📅 レッスン</p>
          <ul className="space-y-2">
            <li>
              <Link
                href="/student/reserve"
                className={`flex items-center gap-3 px-4 py-2 rounded-lg transition ${
                  isActive('/student/reserve')
                    ? 'bg-indigo-50 text-indigo-600 font-semibold'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Calendar size={18} />
                <span>レッスン一覧・予約</span>
              </Link>
            </li>
            <li>
              <Link
                href="/student/my-lessons"
                className={`flex items-center gap-3 px-4 py-2 rounded-lg transition ${
                  isActive('/student/my-lessons')
                    ? 'bg-indigo-50 text-indigo-600 font-semibold'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Calendar size={18} />
                <span>予約済みレッスン</span>
              </Link>
            </li>
          </ul>
        </div>

        {/* カルテ */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase mb-3">📝 カルテ</p>
          <ul className="space-y-2">
            <li>
              <Link
                href="/student/records"
                className={`flex items-center gap-3 px-4 py-2 rounded-lg transition ${
                  isActive('/student/records')
                    ? 'bg-indigo-50 text-indigo-600 font-semibold'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <BookOpen size={18} />
                <span>先生からのメモ</span>
              </Link>
            </li>
          </ul>
        </div>

        {/* プロフィール */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase mb-3">👤 プロフィール</p>
          <ul className="space-y-2">
            <li>
              <Link
                href="/student/profile"
                className={`flex items-center gap-3 px-4 py-2 rounded-lg transition ${
                  isActive('/student/profile')
                    ? 'bg-indigo-50 text-indigo-600 font-semibold'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <User size={18} />
                <span>プロフィール編集</span>
              </Link>
            </li>
          </ul>
        </div>
      </nav>
    </aside>
  )
}
