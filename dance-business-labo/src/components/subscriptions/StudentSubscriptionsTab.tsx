'use client'

import { useEffect, useState } from 'react'
import { Plus, Edit, Trash2 } from 'lucide-react'
import { StudentSubscription, Student } from '@/types/database'
import StudentSubscriptionModal from './StudentSubscriptionModal'

export default function StudentSubscriptionsTab() {
  const [subscriptions, setSubscriptions] = useState<
    (StudentSubscription & { students: Student | null })[]
  >([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingSubscription, setEditingSubscription] = useState<
    StudentSubscription | null
  >(null)

  const fetchData = async () => {
    try {
      setLoading(true)
      const [subsRes, studentsRes] = await Promise.all([
        fetch('/api/dashboard/subscriptions?status=active'),
        fetch('/api/students'),
      ])
      const subsResult = await subsRes.json()
      const studentsResult = await studentsRes.json()
      setSubscriptions(subsResult.data || [])
      setStudents(studentsResult.data || [])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('この割り当てを削除しますか？')) return

    try {
      const res = await fetch(`/api/dashboard/subscriptions/${id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setSubscriptions(subscriptions.filter((s) => s.id !== id))
      }
    } catch (error) {
      console.error('Error deleting subscription:', error)
    }
  }

  const handleOpenModal = (sub?: StudentSubscription) => {
    setEditingSubscription(sub || null)
    setModalOpen(true)
  }

  const handleCloseModal = () => {
    setModalOpen(false)
    setEditingSubscription(null)
  }

  const handleSave = () => {
    // 生徒名・プラン名は一覧側の結合(join)で取得しているため、保存直後の
    // レスポンスだけでは持っておらず、手元でリストに継ぎ足すと「-」表示になる。
    // 素直に一覧を取り直す。
    fetchData()
    handleCloseModal()
  }

  if (loading) {
    return <div className="text-center py-8 text-gray-500">読み込み中...</div>
  }

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold text-gray-800">月謝割り当て一覧</h2>
        <button
          onClick={() => handleOpenModal()}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium"
        >
          <Plus size={18} />
          新規割り当て
        </button>
      </div>

      {subscriptions.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p>月謝割り当てがまだ登録されていません</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-semibold text-gray-700">生徒名</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">プラン</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">開始日</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">月額料金</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">ステータス</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700">操作</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((sub) => (
                <tr key={sub.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-800 font-medium">
                    {sub.students?.name || '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {sub.subscription_types?.name || '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {new Date(sub.start_date).toLocaleDateString('ja-JP')}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    ¥{sub.monthly_price.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                        sub.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : sub.status === 'paused'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {sub.status === 'active'
                        ? '有効'
                        : sub.status === 'paused'
                          ? '一時停止'
                          : 'キャンセル済み'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleOpenModal(sub)}
                        className="p-2 hover:bg-blue-100 text-blue-600 rounded"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(sub.id)}
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
        <StudentSubscriptionModal
          subscription={editingSubscription}
          students={students}
          onClose={handleCloseModal}
          onSave={handleSave}
        />
      )}
    </>
  )
}
