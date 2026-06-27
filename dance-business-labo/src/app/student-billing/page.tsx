'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

export default function StudentBillingPage() {
  const router = useRouter()
  const [subscriptionTypes, setSubscriptionTypes] = useState<any[]>([])
  const [ticketTypes, setTicketTypes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

        if (!supabaseUrl || !anonKey) {
          throw new Error('Missing Supabase configuration')
        }

        const supabase = createClient(supabaseUrl, anonKey)
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          router.push('/login')
          return
        }

        setUserEmail(user.email || null)

        // Get subscription types
        const subResponse = await fetch(
          `${supabaseUrl}/rest/v1/subscription_types?select=*`,
          {
            headers: {
              apikey: anonKey,
              Authorization: `Bearer ${anonKey}`,
            },
          }
        )

        if (subResponse.ok) {
          const subs = await subResponse.json()
          setSubscriptionTypes(subs)
        }

        // Get ticket types
        const ticketRes = await fetch(
          `${supabaseUrl}/rest/v1/ticket_types?select=*`,
          {
            headers: {
              apikey: anonKey,
              Authorization: `Bearer ${anonKey}`,
            },
          }
        )

        if (ticketRes.ok) {
          const tickets = await ticketRes.json()
          setTicketTypes(tickets)
        }
      } catch (err) {
        console.error('Error:', err)
        setError(err instanceof Error ? err.message : 'エラーが発生しました')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">支払い管理</h1>
          <div className="text-center py-12">読み込み中...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-4">
          <span className="text-sm text-gray-600">【生徒用ポータル】</span>
          {userEmail && (
            <p className="text-sm text-gray-500">ログイン中: {userEmail}</p>
          )}
        </div>
        <h1 className="text-3xl font-bold mb-8">支払い管理</h1>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8 text-red-700">
            {error}
          </div>
        )}

        {/* Subscription Plans */}
        {subscriptionTypes.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4">月謝プラン</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {subscriptionTypes.map((sub: any) => (
                <div key={sub.id} className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                  <h3 className="text-lg font-semibold mb-2">{sub.name}</h3>
                  <p className="text-2xl font-bold text-blue-600 mb-4">
                    ¥{sub.monthly_price.toLocaleString()}
                    <span className="text-sm text-gray-600">/月</span>
                  </p>
                  {sub.max_lessons_per_month && (
                    <p className="text-gray-600 mb-4">月{sub.max_lessons_per_month}回まで</p>
                  )}
                  <button className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition">
                    登録する
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tickets */}
        {ticketTypes.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold mb-4">チケット</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {ticketTypes.map((ticket: any) => (
                <div key={ticket.id} className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                  <h3 className="text-lg font-semibold mb-2">{ticket.name}</h3>
                  <p className="text-gray-600 mb-2">{ticket.total_count}回</p>
                  <p className="text-2xl font-bold text-green-600 mb-2">
                    ¥{ticket.price.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-500 mb-4">
                    有効期限: {ticket.valid_days}日間
                  </p>
                  <button className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition">
                    購入する
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {subscriptionTypes.length === 0 && ticketTypes.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">データを読み込んでいます...</p>
          </div>
        )}
      </div>
    </div>
  )
}
