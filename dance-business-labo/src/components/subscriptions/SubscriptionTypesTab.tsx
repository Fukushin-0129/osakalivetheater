'use client'

import { useEffect, useState } from 'react'
import { Plus, Edit, Trash2 } from 'lucide-react'
import { SubscriptionType } from '@/types/database'
import SubscriptionTypeModal from './SubscriptionTypeModal'

export default function SubscriptionTypesTab() {
  const [types, setTypes] = useState<SubscriptionType[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingType, setEditingType] = useState<SubscriptionType | null>(null)

  const fetchTypes = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/dashboard/subscriptions/types')
      const result = await res.json()
      setTypes(result.data || [])
    } catch (error) {
      console.error('Error fetching subscription types:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTypes()
  }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('このプランを削除しますか？')) return

    try {
      const res = await fetch(`/api/dashboard/subscriptions/types/${id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setTypes(types.filter((t) => t.id !== id))
      }
    } catch (error) {
      console.error('Error deleting subscription type:', error)
    }
  }

  const handleOpenModal = (type?: SubscriptionType) => {
    setEditingType(type || null)
    setModalOpen(true)
  }

  const handleCloseModal = () => {
    setModalOpen(false)
    setEditingType(null)
  }

  const handleSave = (newType: SubscriptionType) => {
    if (editingType) {
      setTypes(types.map((t) => (t.id === newType.id ? newType : t)))
    } else {
      setTypes([...types, newType])
    }
    handleCloseModal()
  }

  if (loading) {
    return <div className="text-center py-8 text-gray-500">読み込み中...</div>
  }

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold text-gray-800">月謝プラン一覧</h2>
        <button
          onClick={() => handleOpenModal()}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium"
        >
          <Plus size={18} />
          新規作成
        </button>
      </div>

      {types.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p>月謝プランがまだ登録されていません</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-semibold text-gray-700">プラン名</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">月額料金</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">月間レッスン上限</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700">操作</th>
              </tr>
            </thead>
            <tbody>
              {types.map((type) => (
                <tr key={type.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-800 font-medium">{type.name}</td>
                  <td className="px-4 py-3 text-gray-700">¥{type.monthly_price.toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {type.max_lessons_per_month === null ? '無制限' : `${type.max_lessons_per_month}回`}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleOpenModal(type)}
                        className="p-2 hover:bg-blue-100 text-blue-600 rounded"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(type.id)}
                        className="p-2 hover:bg-red-100 text-red-600 rounded"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <SubscriptionTypeModal
          type={editingType}
          onClose={handleCloseModal}
          onSave={handleSave}
        />
      )}
    </>
  )
}
