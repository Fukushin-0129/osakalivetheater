'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { StudentSubscription, Student, SubscriptionType } from '@/types/database'

interface StudentSubscriptionModalProps {
  subscription: StudentSubscription | null
  students: Student[]
  onClose: () => void
  onSave: (subscription: StudentSubscription) => void
}

export default function StudentSubscriptionModal({
  subscription,
  students,
  onClose,
  onSave,
}: StudentSubscriptionModalProps) {
  const [studentId, setStudentId] = useState(subscription?.student_id || '')
  const [subscriptionTypeId, setSubscriptionTypeId] = useState(
    subscription?.subscription_type_id || ''
  )
  const [startDate, setStartDate] = useState(
    subscription ? subscription.start_date : new Date().toISOString().split('T')[0]
  )
  const [billingDay, setBillingDay] = useState(
    subscription?.billing_day?.toString() || '1'
  )
  const [endDate, setEndDate] = useState(subscription?.end_date || '')
  const [status, setStatus] = useState<'active' | 'paused' | 'cancelled'>(
    subscription?.status || 'active'
  )
  const [types, setTypes] = useState<SubscriptionType[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchTypes = async () => {
      try {
        const res = await fetch('/api/dashboard/subscriptions/types')
        const result = await res.json()
        setTypes(result.data || [])
      } catch (err) {
        console.error('Error fetching subscription types:', err)
      }
    }
    fetchTypes()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!studentId || !subscriptionTypeId || !startDate) {
      setError('生徒、プラン、開始日は必須です')
      return
    }

    try {
      setLoading(true)
      const payload = {
        student_id: studentId,
        subscription_type_id: subscriptionTypeId,
        start_date: startDate,
        billing_day: parseInt(billingDay),
        end_date: endDate || null,
        status,
      }

      const url = subscription
        ? `/api/dashboard/subscriptions/${subscription.id}`
        : '/api/dashboard/subscriptions'
      const method = subscription ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error('Save failed')

      const result = await res.json()
      onSave(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full mx-4">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-800">
            {subscription ? '割り当て編集' : '新規割り当て'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              生徒 *
            </label>
            <select
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              disabled={!!subscription}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50"
            >
              <option value="">選択してください</option>
              {students.filter((s) => s.is_active).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              プラン *
            </label>
            <select
              value={subscriptionTypeId}
              onChange={(e) => setSubscriptionTypeId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">選択してください</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} (¥{t.monthly_price.toLocaleString()}/月)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              開始日 *
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              請求日（毎月○日）
            </label>
            <input
              type="number"
              value={billingDay}
              onChange={(e) => setBillingDay(e.target.value)}
              min="1"
              max="31"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              終了日（オプション）
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ステータス
            </label>
            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as 'active' | 'paused' | 'cancelled')
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="active">有効</option>
              <option value="paused">一時停止</option>
              <option value="cancelled">キャンセル済み</option>
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
