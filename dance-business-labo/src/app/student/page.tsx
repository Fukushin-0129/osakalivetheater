'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ArrowRight, Calendar, CreditCard, BookOpen } from 'lucide-react'

interface Student {
  id: string
  name: string
  email: string
}

export default function StudentDashboard() {
  const [student, setStudent] = useState<Student | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStudentInfo = async () => {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (user) {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
          const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

          const res = await fetch(
            `${supabaseUrl}/rest/v1/students?email=eq.${encodeURIComponent(user.email || '')}&select=id,name,email`,
            {
              headers: {
                apikey: anonKey!,
                Authorization: `Bearer ${anonKey}`,
              },
            }
          )

          const students = await res.json()
          if (Array.isArray(students) && students.length > 0) {
            setStudent(students[0])
          }
        }
      } catch (error) {
        console.error('Error fetching student info:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStudentInfo()
  }, [])

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* ウェルカムセクション */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          生徒ポータルへようこそ！
        </h1>
        <p className="text-gray-600">
          {student?.name ? `${student.name}さん` : 'こんにちは'}
        </p>
      </div>

      {/* ダッシュボードカード */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 次のレッスン */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">次のレッスン</h3>
            <Calendar className="text-blue-600" size={24} />
          </div>
          <p className="text-sm text-gray-600 mb-4">予定されているレッスンはまだありません</p>
          <Link
            href="/student/reserve"
            className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center gap-1"
          >
            予約する <ArrowRight size={16} />
          </Link>
        </div>

        {/* 月謝プラン */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">月謝プラン</h3>
            <CreditCard className="text-green-600" size={24} />
          </div>
          <p className="text-sm text-gray-600 mb-4">プランに登録してレッスンを受講できます</p>
          <Link
            href="/student/billing"
            className="text-green-600 hover:text-green-700 font-medium text-sm flex items-center gap-1"
          >
            プランを選ぶ <ArrowRight size={16} />
          </Link>
        </div>

        {/* チケット残枚数 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">チケット</h3>
            <div className="text-3xl font-bold text-purple-600">0</div>
          </div>
          <p className="text-sm text-gray-600 mb-4">チケット販売中</p>
          <Link
            href="/student/billing"
            className="text-purple-600 hover:text-purple-700 font-medium text-sm flex items-center gap-1"
          >
            購入する <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      {/* メニューセクション */}
      <div className="space-y-6">
        {/* 支払い管理 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-1">💳 支払い管理</h3>
              <p className="text-gray-600 text-sm">
                月謝やチケットの購入・管理ができます
              </p>
            </div>
            <Link
              href="/student/billing"
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition"
            >
              詳細へ <ArrowRight size={18} />
            </Link>
          </div>
        </div>

        {/* レッスン予約 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-1">📅 レッスン予約</h3>
              <p className="text-gray-600 text-sm">
                予約可能なレッスンを見つけて予約できます
              </p>
            </div>
            <Link
              href="/student/reserve"
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition"
            >
              詳細へ <ArrowRight size={18} />
            </Link>
          </div>
        </div>

        {/* カルテ */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-1">📝 カルテ</h3>
              <p className="text-gray-600 text-sm">
                先生からのメモや学習記録を確認できます
              </p>
            </div>
            <Link
              href="/student/records"
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition"
            >
              詳細へ <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
