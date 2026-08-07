'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import type { Student, PaymentType, PaymentStatus } from '@/types/database'

const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'

function todayStr() {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

export default function NewPaymentModal({
  students,
  onClose,
  onSaved,
}: {
  students: Student[]
  onClose: () => void
  onSaved: () => void
}) {
  const [studentId, setStudentId] = useState('')
  const [amount, setAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(todayStr())
  const [paymentType, setPaymentType] = useState<PaymentType>('manual')
  const [status, setStatus] = useState<PaymentStatus>('completed')
  const [subsidyAmount, setSubsidyAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!studentId || !amount || Number(amount) <= 0) {
      setError('生徒と金額は必須です')
      return
    }
    const subsidy = Number(subsidyAmount) || 0
    if (subsidy > Number(amount)) {
      setError('助成クーポン充当額は支払い金額を超えられません')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/dashboard/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          amount: Number(amount),
          payment_date: paymentDate,
          payment_type: paymentType,
          status,
          subsidy_amount: subsidy,
          subsidy_received: false,
          notes: notes || null,
        }),
      })
      if (!res.ok) throw new Error('保存に失敗しました')
      onSaved()
    } catch {
      setError('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">支払いを記録</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-4">
          {error && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">{error}</div>}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">生徒 *</label>
            <select value={studentId} onChange={e => setStudentId(e.target.value)} className={inputCls}>
              <option value="">選択してください</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.name}{s.subsidy_program ? '（助成対象）' : ''}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">金額（円） *</label>
            <input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder="5000" className={inputCls} />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">支払い日</label>
            <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className={inputCls} />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">種別</label>
            <select value={paymentType} onChange={e => setPaymentType(e.target.value as PaymentType)} className={inputCls}>
              <option value="manual">その他</option>
              <option value="subscription_payment">月謝</option>
              <option value="ticket_purchase">チケット購入</option>
              <option value="trial_lesson_payment">体験レッスン</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">ステータス</label>
            <select value={status} onChange={e => setStatus(e.target.value as PaymentStatus)} className={inputCls}>
              <option value="completed">完済</option>
              <option value="pending">未払い</option>
              <option value="failed">失敗</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">助成クーポン充当額（任意）</label>
            <input type="number" min="0" value={subsidyAmount} onChange={e => setSubsidyAmount(e.target.value)} placeholder="0" className={inputCls} />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">メモ（任意）</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={inputCls} />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white py-2.5 rounded-xl text-sm font-medium"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
