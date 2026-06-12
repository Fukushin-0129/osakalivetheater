'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Transaction } from '@/types/database'
import { Plus, Trash2, TrendingUp, TrendingDown } from 'lucide-react'

const INCOME_CATEGORIES = ['レッスン料', 'チケット販売', 'グッズ', 'その他収入']
const EXPENSE_CATEGORIES = ['会場費', '交通費', '衣装・道具', '広告費', '通信費', 'その他経費']

export default function FinancePage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [year, setYear] = useState(new Date().getFullYear())
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ transaction_date: new Date().toISOString().split('T')[0], type: 'income', category: INCOME_CATEGORIES[0], amount: '', description: '' })
  const supabase = createClient()

  async function load() {
    const { data } = await supabase.from('transactions').select('*').gte('transaction_date', `${year}-01-01`).lte('transaction_date', `${year}-12-31`).order('transaction_date', { ascending: false })
    setTransactions(data ?? [])
  }

  useEffect(() => { load() }, [year])

  async function handleSave() {
    if (!form.amount || Number(form.amount) <= 0) return
    await supabase.from('transactions').insert({ ...form, amount: Number(form.amount) })
    setShowModal(false)
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('この明細を削除しますか？')) return
    await supabase.from('transactions').delete().eq('id', id)
    load()
  }

  const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const profit = income - expense

  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, '0')
    const monthTx = transactions.filter(t => t.transaction_date.startsWith(`${year}-${month}`))
    return {
      month: `${i + 1}月`,
      income: monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
      expense: monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    }
  })

  const maxAmount = Math.max(...monthlyData.map(m => Math.max(m.income, m.expense)), 1)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-800">損益管理</h1>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}年</option>)}
          </select>
        </div>
        <button onClick={() => { setForm({ transaction_date: new Date().toISOString().split('T')[0], type: 'income', category: INCOME_CATEGORIES[0], amount: '', description: '' }); setShowModal(true) }}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          <Plus size={16} /> 明細追加
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-2 text-green-600 text-xs font-medium mb-1"><TrendingUp size={14} /> 収入合計</div>
          <div className="text-xl font-bold text-green-700">¥{income.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-2 text-red-500 text-xs font-medium mb-1"><TrendingDown size={14} /> 支出合計</div>
          <div className="text-xl font-bold text-red-600">¥{expense.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="text-xs font-medium text-gray-500 mb-1">損益</div>
          <div className={`text-xl font-bold ${profit >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>¥{profit.toLocaleString()}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">月次推移</h2>
        <div className="flex items-end gap-1 h-32">
          {monthlyData.map(m => (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-0.5">
              <div className="w-full flex gap-0.5 items-end h-24">
                <div className="flex-1 bg-green-400 rounded-t transition-all" style={{ height: `${(m.income / maxAmount) * 100}%` }} title={`収入: ¥${m.income.toLocaleString()}`} />
                <div className="flex-1 bg-red-400 rounded-t transition-all" style={{ height: `${(m.expense / maxAmount) * 100}%` }} title={`支出: ¥${m.expense.toLocaleString()}`} />
              </div>
              <div className="text-xs text-gray-400">{m.month}</div>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-2 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-400 rounded-sm inline-block" />収入</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-400 rounded-sm inline-block" />支出</span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs">
            <tr>
              <th className="text-left px-4 py-3">日付</th>
              <th className="text-left px-4 py-3">種別</th>
              <th className="text-left px-4 py-3">カテゴリ</th>
              <th className="text-left px-4 py-3">金額</th>
              <th className="text-left px-4 py-3 hidden md:table-cell">内容</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {transactions.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-gray-400">明細なし</td></tr>}
            {transactions.map(t => (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-600">{t.transaction_date}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${t.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                    {t.type === 'income' ? '収入' : '支出'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{t.category}</td>
                <td className={`px-4 py-3 font-medium ${t.type === 'income' ? 'text-green-700' : 'text-red-600'}`}>
                  {t.type === 'expense' ? '-' : ''}¥{t.amount.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{t.description}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleDelete(t.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={15} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold mb-4">明細を追加</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600">日付</label>
                <input type="date" value={form.transaction_date} onChange={e => setForm(f => ({ ...f, transaction_date: e.target.value }))} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">種別</label>
                <div className="flex gap-2 mt-1">
                  {[{ v: 'income', l: '収入' }, { v: 'expense', l: '支出' }].map(opt => (
                    <button key={opt.v} onClick={() => setForm(f => ({ ...f, type: opt.v, category: opt.v === 'income' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0] }))}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${form.type === opt.v ? (opt.v === 'income' ? 'bg-green-500 text-white' : 'bg-red-500 text-white') : 'bg-gray-100 text-gray-600'}`}>
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">カテゴリ</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {(form.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">金額（円）</label>
                <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="0" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">内容・メモ</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg text-sm">キャンセル</button>
              <button onClick={handleSave} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-sm font-medium">保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
