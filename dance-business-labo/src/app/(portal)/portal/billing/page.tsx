'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

interface SubscriptionType {
  id: string
  name: string
  monthly_price: number
  max_lessons_per_month?: number
}

interface TicketType {
  id: string
  name: string
  total_count: number
  price: number
  valid_days: number
}

interface StudentTicket {
  id: string
  ticket_type_id: string
  total_count: number
  used_count: number
  expires_at: string
}

interface StudentSubscription {
  id: string
  subscription_type_id: string
  status: string
  start_date: string
  next_payment_date: string
}

export default function BillingPage() {
  const router = useRouter()
  const [subscriptionTypes, setSubscriptionTypes] = useState<SubscriptionType[]>([])
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([])
  const [studentSubscriptions, setStudentSubscriptions] = useState<StudentSubscription[]>([])
  const [studentTickets, setStudentTickets] = useState<StudentTicket[]>([])
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

        // Get subscription types from REST API
        const subResponse = await fetch(
          `${supabaseUrl}/rest/v1/subscription_types?select=*`,
          {
            headers: {
              apikey: anonKey,
              Authorization: `Bearer ${anonKey}`,
            },
          }
        )

        if (!subResponse.ok) {
          throw new Error(`Failed to fetch subscriptions: ${subResponse.status}`)
        }

        const subs = await subResponse.json()
        setSubscriptionTypes(subs)

        // Get ticket types from REST API
        const ticketRes = await fetch(
          `${supabaseUrl}/rest/v1/ticket_types?select=*`,
          {
            headers: {
              apikey: anonKey,
              Authorization: `Bearer ${anonKey}`,
            },
          }
        )

        if (!ticketRes.ok) {
          throw new Error('Failed to fetch ticket types')
        }

        const tickets = await ticketRes.json()
        setTicketTypes(tickets)

        // Get student data using client
        const supabase = createClient(supabaseUrl, anonKey)
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          router.push('/login')
          return
        }

        setUserEmail(user.email || null)

        // Get student subscriptions
        const { data: subscriptions } = await supabase
          .from('student_subscriptions')
          .select('*')
          .eq('student_id', user.id)

        setStudentSubscriptions(subscriptions || [])

        // Get student tickets
        const { data: tickets } = await supabase
          .from('student_tickets')
          .select('*')
          .eq('student_id', user.id)

        setStudentTickets(tickets || [])
      } catch (err) {
        console.error('Error fetching billing data:', err)
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [router])

  const handleSubscribe = async (subscriptionTypeId: string) => {
    try {
      const response = await fetch('/api/portal/billing/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription_type_id: subscriptionTypeId,
          student_id: (await createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
          ).auth.getUser()).data.user?.id,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create subscription session')
      }

      const { url } = await response.json()
      if (url) {
        window.location.href = url
      }
    } catch (err) {
      console.error('Error subscribing:', err)
      setError(err instanceof Error ? err.message : 'Failed to subscribe')
    }
  }

  const handlePurchaseTicket = async (ticketTypeId: string) => {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const response = await fetch('/api/portal/billing/purchase-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_type_id: ticketTypeId,
          student_id: user.id,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create checkout session')
      }

      const { url } = await response.json()
      if (url) {
        window.location.href = url
      }
    } catch (err) {
      console.error('Error purchasing ticket:', err)
      setError(err instanceof Error ? err.message : 'Failed to purchase ticket')
    }
  }

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
          <span className="text-sm text-gray-600">【生徒ポータル】</span>
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

        {/* Subscription Status */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">月謝プラン</h2>
          {studentSubscriptions.length > 0 ? (
            <div className="space-y-4">
              {studentSubscriptions.map((sub) => {
                const subType = subscriptionTypes.find((s) => s.id === sub.subscription_type_id)
                return (
                  <div key={sub.id} className="border border-gray-200 rounded p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-lg">{subType?.name}</p>
                        <p className="text-gray-600">
                          ¥{subType?.monthly_price.toLocaleString()}/月
                        </p>
                        <p className="text-sm text-gray-500 mt-2">
                          開始日: {new Date(sub.start_date).toLocaleDateString('ja-JP')}
                        </p>
                        <p className="text-sm text-gray-500">
                          次回支払い日: {new Date(sub.next_payment_date).toLocaleDateString('ja-JP')}
                        </p>
                      </div>
                      <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                        {sub.status === 'active' ? '有効' : 'その他'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-gray-500 mb-6">月謝プラン未割り当て</p>
          )}
        </div>

        {/* Subscription Plans Available */}
        {studentSubscriptions.length === 0 && subscriptionTypes.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {subscriptionTypes.map((sub) => (
              <div key={sub.id} className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                <h3 className="text-lg font-semibold mb-2">{sub.name}</h3>
                <p className="text-2xl font-bold text-blue-600 mb-4">
                  ¥{sub.monthly_price.toLocaleString()}
                  <span className="text-sm text-gray-600">/月</span>
                </p>
                {sub.max_lessons_per_month && (
                  <p className="text-gray-600 mb-4">月{sub.max_lessons_per_month}回まで</p>
                )}
                <button
                  onClick={() => handleSubscribe(sub.id)}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition"
                >
                  登録する
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Tickets Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">チケット</h2>
          {studentTickets.length > 0 ? (
            <div className="space-y-4">
              {studentTickets.map((ticket) => {
                const ticketType = ticketTypes.find((t) => t.id === ticket.ticket_type_id)
                return (
                  <div key={ticket.id} className="border border-gray-200 rounded p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-lg">{ticketType?.name}</p>
                        <p className="text-gray-600">
                          使用済み: {ticket.used_count}/{ticket.total_count}
                        </p>
                        <p className="text-sm text-gray-500 mt-2">
                          有効期限: {new Date(ticket.expires_at).toLocaleDateString('ja-JP')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-green-600">
                          {ticket.total_count - ticket.used_count}
                        </p>
                        <p className="text-sm text-gray-500">残数</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-gray-500 mb-6">チケット未購入</p>
          )}
        </div>

        {/* Available Tickets to Purchase */}
        {ticketTypes.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">新規チケット購入</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {ticketTypes.map((ticket) => (
                <div key={ticket.id} className="border border-gray-200 rounded p-4">
                  <h3 className="text-lg font-semibold mb-2">{ticket.name}</h3>
                  <p className="text-gray-600 mb-2">{ticket.total_count}回チケット</p>
                  <p className="text-2xl font-bold text-green-600 mb-2">
                    ¥{ticket.price.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-500 mb-4">
                    有効期限: {ticket.valid_days}日間
                  </p>
                  <button
                    onClick={() => handlePurchaseTicket(ticket.id)}
                    className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition"
                  >
                    購入する
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
