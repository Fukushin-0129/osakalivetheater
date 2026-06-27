'use client'

import { useEffect, useState } from 'react'
import { StudentPayment, Student } from '@/types/database'

export default function PaymentHistoryTab() {
  const [payments, setPayments] = useState<(StudentPayment & { students: Student | null })[]>(
    []
  )
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'completed' | 'pending' | 'failed'>(
    'all'
  )

  const fetchPayments = async () => {
    try {
      setLoading(true)
      const url =
        filter === 'all'
          ? '/api/dashboard/payments'
          : `/api/dashboard/payments?status=${filter}`
      const res = await fetch(url)
      const result = await res.json()
      setPayments(result.data || [])
    } catch (error) {
      console.error('Error fetching payments:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPayments()
  }, [filter])

  if (loading) {
    return <div className="text-center py-8 text-gray-500">読み込み中...</div>
  }

  return (
    <>
      <div className="flex gap-2 mb-6">
        {(['all', 'completed', 'pending', 'failed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {f === 'all'
              ? 'すべて'
              : f === 'completed'
                ? '完済'
                : f === 'pending'
                  ? '未払い'
                  : '失敗'}
          </button>
        ))}
      </div>

      {payments.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p>支払い履歴がありません</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-semibold text-gray-700">生徒名</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">金額</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">支払い日</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">種別</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">ステータス</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-800 font-medium">
                    {payment.students?.name || '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-700 font-medium">
                    ¥{payment.amount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {new Date(payment.payment_date).toLocaleDateString('ja-JP')}
                  </td>
                  <td className="px-4 py-3 text-gray-700 text-xs">
                    {payment.payment_type === 'ticket_purchase'
                      ? 'チケット購入'
                      : payment.payment_type === 'subscription_payment'
                        ? '月謝'
                        : 'その他'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                        payment.status === 'completed'
                          ? 'bg-green-100 text-green-700'
                          : payment.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {payment.status === 'completed'
                        ? '完済'
                        : payment.status === 'pending'
                          ? '未払い'
                          : '失敗'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
