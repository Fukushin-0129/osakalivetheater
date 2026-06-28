'use client'

import { useEffect, useState } from 'react'

interface SubscriptionType {
  id: string
  name: string
  monthly_price: number
  max_lessons_per_month: number
  description?: string
}

interface TicketType {
  id: string
  name: string
  total_count: number
  price: number
  valid_days: number
}

export default function StudentBillingPage() {
  const [subscriptions, setSubscriptions] = useState<SubscriptionType[]>([])
  const [tickets, setTickets] = useState<TicketType[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

        // subscription_types を取得
        const subRes = await fetch(
          `${supabaseUrl}/rest/v1/subscription_types?select=*`,
          {
            headers: {
              apikey: anonKey!,
              Authorization: `Bearer ${anonKey}`,
            },
          }
        )

        if (subRes.ok) {
          const subs = await subRes.json()
          if (Array.isArray(subs)) {
            setSubscriptions(subs)
          }
        } else {
          // API が無効な場合はダミーデータを表示
          setSubscriptions([
            {
              id: '1',
              name: 'ベーシックプラン',
              monthly_price: 8000,
              max_lessons_per_month: 4,
              description: '月4回までのレッスンプラン',
            },
            {
              id: '2',
              name: 'スタンダードプラン',
              monthly_price: 12000,
              max_lessons_per_month: 8,
              description: '月8回までのレッスンプラン',
            },
            {
              id: '3',
              name: 'プレミアムプラン',
              monthly_price: 15000,
              max_lessons_per_month: 12,
              description: '月12回までのレッスンプラン（無制限）',
            },
          ])
        }

        // ticket_types を取得
        const ticketRes = await fetch(
          `${supabaseUrl}/rest/v1/ticket_types?select=*`,
          {
            headers: {
              apikey: anonKey!,
              Authorization: `Bearer ${anonKey}`,
            },
          }
        )

        if (ticketRes.ok) {
          const ticketData = await ticketRes.json()
          if (Array.isArray(ticketData)) {
            setTickets(ticketData)
          }
        } else {
          // API が無効な場合はダミーデータを表示
          setTickets([
            {
              id: '1',
              name: '10回チケット',
              total_count: 10,
              price: 15000,
              valid_days: 180,
            },
            {
              id: '2',
              name: '5回チケット',
              total_count: 5,
              price: 8000,
              valid_days: 180,
            },
          ])
        }
      } catch (error) {
        console.error('Error fetching billing data:', error)
        // エラー時もダミーデータを表示
        setSubscriptions([
          {
            id: '1',
            name: 'ベーシックプラン',
            monthly_price: 8000,
            max_lessons_per_month: 4,
          },
          {
            id: '2',
            name: 'スタンダードプラン',
            monthly_price: 12000,
            max_lessons_per_month: 8,
          },
          {
            id: '3',
            name: 'プレミアムプラン',
            monthly_price: 15000,
            max_lessons_per_month: 12,
          },
        ])
        setTickets([
          { id: '1', name: '10回チケット', total_count: 10, price: 15000, valid_days: 180 },
          { id: '2', name: '5回チケット', total_count: 5, price: 8000, valid_days: 180 },
        ])
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return <div className="text-center py-12">読み込み中...</div>
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">💳 支払い管理</h1>

      {/* 月謝プラン */}
      {subscriptions.length > 0 && (
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">月謝プラン</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {subscriptions.map((sub) => (
              <div
                key={sub.id}
                className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 hover:shadow-md transition"
              >
                <h3 className="text-lg font-semibold mb-2">{sub.name}</h3>
                {sub.description && (
                  <p className="text-sm text-gray-600 mb-3">{sub.description}</p>
                )}
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

      {/* チケット */}
      {tickets.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold mb-4">チケット</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {tickets.map((ticket) => (
              <div
                key={ticket.id}
                className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 hover:shadow-md transition"
              >
                <h3 className="text-lg font-semibold mb-2">{ticket.name}</h3>
                <p className="text-gray-600 mb-2">{ticket.total_count}回</p>
                <p className="text-2xl font-bold text-green-600 mb-2">
                  ¥{ticket.price.toLocaleString()}
                </p>
                <p className="text-sm text-gray-500 mb-4">有効期限: {ticket.valid_days}日間</p>
                <button className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition">
                  購入する
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
