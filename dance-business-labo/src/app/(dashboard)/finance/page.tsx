'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Transaction } from '@/types/database'
import { Plus, Trash2, TrendingUp, TrendingDown, DollarSign, X, Loader2, ChevronDown, ChevronUp } from 'lucide-react'

const INCOME_CATEGORIES = ['レッスン料', 'チケット販売', 'グッズ', 'その他収入']
const EXPENSE_CATEGORIES = ['レッスン場代', '会場費', '交通費', '衣装・道具', '広告費', '通信費', 'その他経費']
const DEFAULT_VENUE = '山田ふれあい文化センター練習室'
const MONTHS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']

const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'

const CATEGORY_COLORS: Record<string, string> = {
  'レッスン料': 'bg-green-500',
  'チケット販売': 'bg-emerald-400',
  'グッズ': 'bg-teal-400',
  'その他収入': 'bg-cyan-400',
  '会場費': 'bg-red-500',
  '交通費': 'bg-orange-400',
  '衣装・道具': 'bg-amber-400',
  '広告費': 'bg-pink-400',
  '通信費': 'bg-rose-400',
  'その他経費': 'bg-purple-400',
}

export default function FinancePage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [year, setYear] = useState(new Date().getFullYear())
  const [showModal, setShowModal] = useState(false)
  const [showLessonModal, setShowLessonModal] = useState(false)
  const [expandedMonth, setExpandedMonth] = useState<number | null>(new Date().getMonth())
  const [form, setForm] = useState({
    transaction_date: new Date().toISOString().split('T')[0],
    type: 'income',
    category: INCOME_CATEGORIES[0],
    amount: '',
    description: '',
  })
  const [lessonForm, setLessonForm] = useState({
    lesson_date: new Date().toISOString().split('T')[0],
    venue: DEFAULT_VENUE,
    amount: '',
  })
  const supabase = createClient()

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .gte('transaction_date', `${year}-01-01`)
      .lte('transaction_date', `${year}-12-31`)
      .order('transaction_date', { ascending: false })
    setTransactions(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [year])

  async function handleSave() {
    if (!form.amount || Number(form.amount) <= 0) return
    setSaving(true)
    await supabase.from('transactions').insert({ ...form, amount: Number(form.amount) })
    setSaving(false)
    setShowModal(false)
    load()
  }

  async function handleLessonSave() {
    if (!lessonForm.amount || Number(lessonForm.amount) <= 0) return
    setSaving(true)
    await supabase.from('transactions').insert({
      transaction_date: lessonForm.lesson_date,
      type: 'expense',
      category: 'レッスン場代',
      amount: Number(lessonForm.amount),
      description: lessonForm.venue,
    })
    setSaving(false)
    setShowLessonModal(false)
    setLessonForm({ lesson_date: new Date().toISOString().split('T')[0], venue: DEFAULT_VENUE, amount: '' })
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('この明細を削除しますか？')) return
    await supabase.from('transactions').delete().eq('id', id)
    load()
  }

  const income = useMemo(() => transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0), [transactions])
  const expense = useMemo(() => transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0), [transactions])
  const profit = income - expense

  // 月次データ
  const monthlyData = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, '0')
    const monthTx = transactions.filter(t => t.transaction_date.startsWith(`${year}-${month}`))
    return {
      label: MONTHS[i],
      income: monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
      expense: monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
      transactions: monthTx,
    }
  }), [transactions, year])

  const maxAmount = Math.max(...monthlyData.map(m => Math.max(m.income, m.expense)), 1)

  // カテゴリ別集計
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {}
    for (const t of transactions) {
      map[t.category] = (map[t.category] ?? 0) + t.amount
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [transactions])

  const availableYears = [2024, 2025, 2026, 2027]

  return (
    <div>
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-800">損益管理</h1>
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {availableYears.map(y => <option key={y} value={y}>{y}年</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setLessonForm({ lesson_date: new Date().toISOString().split('T')[0], venue: DEFAULT_VENUE, amount: '' })
              setShowLessonModal(true)
            }}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-sm transition-colors"
          >
            <Plus size={16} /> レッスン場代
          </button>
          <button
            onClick={() => {
              setForm({ transaction_date: new Date().toISOString().split('T')[0], type: 'income', category: INCOME_CATEGORIES[0], amount: '', description: '' })
              setShowModal(true)
            }}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-sm transition-colors"
          >
            <Plus size={16} /> 明細追加
          </button>
        </div>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-2 text-green-600 text-xs font-medium mb-2">
            <TrendingUp size={14} /> {year}年 収入合計
          </div>
          <div className="text-2xl font-bold text-green-700">¥{income.toLocaleString()}</div>
          <div className="text-xs text-gray-400 mt-1">{transactions.filter(t => t.type === 'income').length}件</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-2 text-red-500 text-xs font-medium mb-2">
            <TrendingDown size={14} /> {year}年 支出合計
          </div>
          <div className="text-2xl font-bold text-red-600">¥{expense.toLocaleString()}</div>
          <div className="text-xs text-gray-400 mt-1">{transactions.filter(t => t.type === 'expense').length}件</div>
        </div>
        <div className={`rounded-xl shadow-sm p-4 ${profit >= 0 ? 'bg-indigo-600' : 'bg-red-600'}`}>
          <div className="flex items-center gap-2 text-white/80 text-xs font-medium mb-2">
            <DollarSign size={14} /> {year}年 損益
          </div>
          <div className="text-2xl font-bold text-white">¥{profit.toLocaleString()}</div>
          <div className="text-xs text-white/60 mt-1">
            利益率 {income > 0 ? Math.round((profit / income) * 100) : 0}%
          </div>
        </div>
      </div>

      {/* 月次棒グラフ */}
      <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">月次推移</h2>
        {loading ? (
          <div className="flex items-center justify-center h-32 text-gray-400">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : (
          <>
            <div className="flex items-end gap-1 h-32 mb-1">
              {monthlyData.map((m, i) => (
                <button
                  key={m.label}
                  onClick={() => setExpandedMonth(expandedMonth === i ? null : i)}
                  className="flex-1 flex flex-col items-center gap-0.5 group"
                >
                  <div className="w-full flex gap-0.5 items-end h-24">
                    <div
                      className="flex-1 bg-green-400 group-hover:bg-green-500 rounded-t transition-all"
                      style={{ height: `${(m.income / maxAmount) * 100}%` }}
                      title={`収入: ¥${m.income.toLocaleString()}`}
                    />
                    <div
                      className="flex-1 bg-red-400 group-hover:bg-red-500 rounded-t transition-all"
                      style={{ height: `${(m.expense / maxAmount) * 100}%` }}
                      title={`支出: ¥${m.expense.toLocaleString()}`}
                    />
                  </div>
                  <div className={`text-xs ${expandedMonth === i ? 'text-indigo-600 font-bold' : 'text-gray-400'}`}>
                    {i + 1}月
                  </div>
                </button>
              ))}
            </div>
            <div className="flex gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-400 rounded-sm inline-block" />収入</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-400 rounded-sm inline-block" />支出</span>
              <span className="text-gray-400 ml-auto">月をクリックで明細表示</span>
            </div>
          </>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* カテゴリ別内訳 */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">カテゴリ別内訳</h2>
          {categoryBreakdown.length === 0 ? (
            <p className="text-gray-400 text-sm">データなし</p>
          ) : (
            <div className="space-y-2">
              {categoryBreakdown.map(([cat, amt]) => {
                const isIncome = INCOME_CATEGORIES.includes(cat)
                const total = isIncome ? income : expense
                const pct = total > 0 ? Math.round((amt / total) * 100) : 0
                return (
                  <div key={cat}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${CATEGORY_COLORS[cat] ?? 'bg-gray-400'}`} />
                        <span className="text-gray-700">{cat}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${isIncome ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                          {isIncome ? '収入' : '支出'}
                        </span>
                      </div>
                      <span className="font-medium text-gray-800">¥{amt.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full ${CATEGORY_COLORS[cat] ?? 'bg-gray-400'}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 月次サマリーテーブル */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">月次サマリー</h2>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-100">
                <th className="text-left pb-2">月</th>
                <th className="text-right pb-2 text-green-600">収入</th>
                <th className="text-right pb-2 text-red-500">支出</th>
                <th className="text-right pb-2 text-indigo-600">損益</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {monthlyData.map((m, i) => {
                const p = m.income - m.expense
                return (
                  <tr key={m.label} className={`${expandedMonth === i ? 'bg-indigo-50' : ''}`}>
                    <td className="py-1.5 font-medium text-gray-700">{m.label}</td>
                    <td className="py-1.5 text-right text-green-700">{m.income > 0 ? `¥${m.income.toLocaleString()}` : '—'}</td>
                    <td className="py-1.5 text-right text-red-600">{m.expense > 0 ? `¥${m.expense.toLocaleString()}` : '—'}</td>
                    <td className={`py-1.5 text-right font-medium ${p > 0 ? 'text-indigo-600' : p < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                      {p !== 0 ? `¥${p.toLocaleString()}` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="border-t-2 border-gray-200">
              <tr>
                <td className="pt-2 font-bold text-gray-700">合計</td>
                <td className="pt-2 text-right font-bold text-green-700">¥{income.toLocaleString()}</td>
                <td className="pt-2 text-right font-bold text-red-600">¥{expense.toLocaleString()}</td>
                <td className={`pt-2 text-right font-bold ${profit >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>¥{profit.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 明細一覧（月別アコーディオン） */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-700 px-1">明細一覧</h2>
        {monthlyData.map((m, i) => {
          if (m.transactions.length === 0) return null
          const isOpen = expandedMonth === i
          const mp = m.income - m.expense
          return (
            <div key={m.label} className="bg-white rounded-xl shadow-sm overflow-hidden">
              <button
                onClick={() => setExpandedMonth(isOpen ? null : i)}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4 text-sm">
                  <span className="font-semibold text-gray-700 w-10">{m.label}</span>
                  <span className="text-green-600">収入 ¥{m.income.toLocaleString()}</span>
                  <span className="text-red-500">支出 ¥{m.expense.toLocaleString()}</span>
                  <span className={`font-medium ${mp >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>
                    損益 ¥{mp.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-gray-400">
                  <span className="text-xs">{m.transactions.length}件</span>
                  {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-gray-100">
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-gray-50">
                      {m.transactions.map(t => (
                        <tr key={t.id} className="hover:bg-gray-50">
                          <td className="px-5 py-2.5 text-gray-500 text-xs w-24">{t.transaction_date}</td>
                          <td className="px-3 py-2.5">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${t.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                              {t.type === 'income' ? '収入' : '支出'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-gray-600">{t.category}</td>
                          <td className={`px-3 py-2.5 font-medium ${t.type === 'income' ? 'text-green-700' : 'text-red-600'}`}>
                            {t.type === 'expense' ? '-' : ''}¥{t.amount.toLocaleString()}
                          </td>
                          <td className="px-3 py-2.5 text-gray-400 hidden md:table-cell">{t.description}</td>
                          <td className="px-3 py-2.5 text-right">
                            <button onClick={() => handleDelete(t.id)} className="text-gray-300 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}
        {!loading && monthlyData.every(m => m.transactions.length === 0) && (
          <div className="bg-white rounded-xl shadow-sm p-10 text-center text-gray-400">
            <DollarSign size={32} className="mx-auto mb-2 opacity-20" />
            <p className="text-sm">{year}年の明細がありません</p>
          </div>
        )}
      </div>

      {/* レッスン場代追加モーダル */}
      {showLessonModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">レッスン場代を追加</h2>
              <button onClick={() => setShowLessonModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600">レッスン日（支払日も同日）</label>
                <input
                  type="date"
                  value={lessonForm.lesson_date}
                  onChange={e => setLessonForm(f => ({ ...f, lesson_date: e.target.value }))}
                  className={`mt-1 ${inputCls}`}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">会場</label>
                <input
                  type="text"
                  value={lessonForm.venue}
                  onChange={e => setLessonForm(f => ({ ...f, venue: e.target.value }))}
                  className={`mt-1 ${inputCls}`}
                  placeholder={DEFAULT_VENUE}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">金額（円）</label>
                <input
                  type="number"
                  value={lessonForm.amount}
                  onChange={e => setLessonForm(f => ({ ...f, amount: e.target.value }))}
                  className={`mt-1 ${inputCls}`}
                  placeholder="0"
                  min="1"
                />
              </div>
              <div className="bg-gray-50 rounded-xl px-4 py-2 text-xs text-gray-500 space-y-0.5">
                <div>種別: <span className="font-medium text-red-600">支出</span></div>
                <div>カテゴリ: <span className="font-medium text-gray-700">レッスン場代</span></div>
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowLessonModal(false)} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50">キャンセル</button>
              <button
                onClick={handleLessonSave}
                disabled={saving || !lessonForm.amount || Number(lessonForm.amount) <= 0}
                className="flex-1 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white py-2.5 rounded-xl text-sm font-medium"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? '保存中...' : '追加する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 明細追加モーダル */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">明細を追加</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600">日付</label>
                <input type="date" value={form.transaction_date} onChange={e => setForm(f => ({ ...f, transaction_date: e.target.value }))} className={`mt-1 ${inputCls}`} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">種別</label>
                <div className="flex gap-2 mt-1">
                  {[{ v: 'income', l: '収入' }, { v: 'expense', l: '支出' }].map(opt => (
                    <button
                      key={opt.v}
                      onClick={() => setForm(f => ({ ...f, type: opt.v, category: opt.v === 'income' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0] }))}
                      className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${form.type === opt.v ? (opt.v === 'income' ? 'bg-green-500 text-white' : 'bg-red-500 text-white') : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">カテゴリ</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={`mt-1 ${inputCls}`}>
                  {(form.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">金額（円）</label>
                <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className={`mt-1 ${inputCls}`} placeholder="0" min="1" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">内容・メモ</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={`mt-1 ${inputCls}`} />
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50">キャンセル</button>
              <button
                onClick={handleSave}
                disabled={saving || !form.amount || Number(form.amount) <= 0}
                className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white py-2.5 rounded-xl text-sm font-medium"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? '保存中...' : '追加する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
