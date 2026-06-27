'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { SubscriptionType } from '@/types/database'

interface SubscriptionTypeModalProps {
  type: SubscriptionType | null
  onClose: () => void
  onSave: (type: SubscriptionType) => void
}

export default function SubscriptionTypeModal({
  type,
  onClose,
  onSave,
}: SubscriptionTypeModalProps) {
  const [name, setName] = useState(type?.name || '')
  const [monthlyPrice, setMonthlyPrice] = useState(
    type?.monthly_price.toString() || ''
  )
  const [maxLessons, setMaxLessons] = useState(
    type?.max_lessons_per_month?.toString() || ''
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!name.trim() || !monthlyPrice) {
      setError('プラン名と月額料金は必須です')
      return
    }

    try {
      setLoading(true)
      const payload = {
        name: name.trim(),
        monthly_price: parseInt(monthlyPrice),
        max_lessons_per_month: maxLessons ? parseInt(maxLessons) : null,
      }

      const url = type
        ? `/api/dashboard/subscriptions/types/${type.id}`
        : '/api/dashboard/subscriptions/types'
      const method = type ? 'PUT' : 'POST'

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
            {type ? 'プラン編集' : '新規プラン作成'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              プラン名 *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 週1回プラン"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              月額料金（円） *
            </label>
            <input
              type="number"
              value={monthlyPrice}
              onChange={(e) => setMonthlyPrice(e.target.value)}
              placeholder="10000"
              min="0"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              月間レッスン上限（回）
            </label>
            <input
              type="number"
              value={maxLessons}
              onChange={(e) => setMaxLessons(e.target.value)}
              placeholder="未入力で無制限"
              min="0"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              未入力の場合、月間レッスン数に制限なし
            </p>
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
