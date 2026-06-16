'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Transaction, Student } from '@/types/database'
import { Plus, Trash2, TrendingUp, TrendingDown, DollarSign, X, Loader2, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react'

const INCOME_CATEGORIES = ['レッスン収入', 'レッスン料', 'チケット販売', 'グッズ', 'その他収入']
const EXPENSE_CATEGORIES = ['レッスン場代', '会場費', '交通費', '衣装・道具', '広告費', '通信費', 'その他経費']
const DEFAULT_VENUE = '山田ふれあい文化センター練習室'
const MONTHS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']
const WEEKDAYS = ['日','月','火','水','木','金','土']

const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'

const CATEGORY_COLORS: Record<string, string> = {
  'レッスン収入': 'bg-green-600',
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

function toYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// 複数日選択カレンダー
function MultiDateCalendar({ selected, onChange }: { selected: Set<string>; onChange: (s: Set<string>) => void }) {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  const firstDay = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const toggle = useCallback((dateStr: string) => {
    const next = new Set(selected)
    if (next.has(dateStr)) next.delete(dateStr)
    else next.add(dateStr)
    onChange(next)
  }, [selected, onChange])

  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]

  return (
    <div className="select-none">
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={prevMonth} className="p-1 rounded hover:bg-gray-100 text-gray-500"><ChevronLeft size={16} /></button>
        <span className="text-sm font-semibold text-gray-700">{viewYear}年 {viewMonth + 1}月</span>
        <button type="button" onClick={nextMonth} className="p-1 rounded hover:bg-gray-100 text-gray-500"><ChevronRight size={16} /></button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {WEEKDAYS.map((d, i) => (
          <div key={d} className={`text-center text-xs py-1 font-medium ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, idx) => {
          if (!day) return <div key={`e${idx}`} />
          const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const isSelected = selected.has(dateStr)
          const dow = (firstDay + day - 1) % 7
          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => toggle(dateStr)}
              className={`aspect-square flex items-center justify-center rounded-full text-sm transition-colors
                ${isSelected
                  ? 'bg-orange-500 text-white font-bold'
                  : dow === 0
                    ? 'text-red-400 hover:bg-red-50'
                    : dow === 6
                      ? 'text-blue-400 hover:bg-blue-50'
                      : 'text-gray-700 hover:bg-gray-100'
                }`}
            >
              {day}
            </button>
          )
        })}
      </div>
      {selected.size > 0 && (
        <div className="mt-2 text-xs text-orange-600 font-medium">
          {selected.size}日選択中
        </div>
      )}
    </div>
  )
}

const initLessonForm = () => ({
  lesson_dates: new Set<string>(),
  payment_date: new Date().toISOString().split('T')[0],
  venue: DEFAULT_VENUE,
  amount: '',
})

function parseStudentId(description: string | null): number | null {
  if (!description) return null
  const m = description.match(/参加者ID:(\d+)/)
  return m ? Number(m[1]) : null
}

type YearlyTotal = { year: number; income: number; expense: number }

export default function FinancePage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [studentMap, setStudentMap] = useState<Map<number, string>>(new Map())
  const [allYearlyTotals, setAllYearlyTotals] = useState<YearlyTotal[]>([])
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
    lesson_date: '',
  })
  const [lessonForm, setLessonForm] = useState(initLessonForm())
  const supabase = createClient()

  async function loadAllYears() {
    const { data } = await supabase
      .from('transactions')
      .select('transaction_date, type, amount')
      .limit(100000)
    if (!data) return
    const map: Record<number, { income: number; expense: number }> = {}
    for (const t of data) {
      const y = Number(t.transaction_date.slice(0, 4))
      if (!map[y]) map[y] = { income: 0, expense: 0 }
      if (t.type === 'income') map[y].income += t.amount
      else map[y].expense += t.amount
    }
    setAllYearlyTotals(Object.entries(map).map(([y, v]) => ({ year: Number(y), ...v })).sort((a, b) => a.year - b.year))
  }

  async function load() {
    setLoading(true)
    const [{ data: txData }, { data: stuData }] = await Promise.all([
      supabase
        .from('transactions')
        .select('*')
        .gte('transaction_date', `${year}-01-01`)
        .lte('transaction_date', `${year}-12-31`)
        .order('transaction_date', { ascending: false }),
      supabase
        .from('students')
        .select('legacy_id, name')
        .not('legacy_id', 'is', null),
    ])
    setTransactions(txData ?? [])
    const map = new Map<number, string>()
    for (const s of (stuData ?? []) as Pick<Student, 'legacy_id' | 'name'>[]) {
      if (s.legacy_id != null) map.set(s.legacy_id, s.name)
    }
    setStudentMap(map)
    setLoading(false)
  }

  useEffect(() => { loadAllYears() }, [])
  useEffect(() => { load() }, [year])

  async function handleSave() {
    if (!form.amount || Number(form.amount) <= 0) return
    setSaving(true)
    const description = form.category === 'レッスン場代' && form.lesson_date
      ? `${form.description || DEFAULT_VENUE}（レッスン日: ${form.lesson_date}）`
      : form.description
    await supabase.from('transactions').insert({ ...form, amount: Number(form.amount), description, lesson_date: undefined })
    setSaving(false)
    setShowModal(false)
    load()
  }

  async function handleLessonSave() {
    if (!lessonForm.amount || Number(lessonForm.amount) <= 0) return
    if (lessonForm.lesson_dates.size === 0) return
    setSaving(true)
    const sortedDates = [...lessonForm.lesson_dates].sort()
    const rows = sortedDates.map(date => ({
      transaction_date: lessonForm.payment_date,
      type: 'expense',
      category: 'レッスン場代',
      amount: Number(lessonForm.amount),
      description: `${lessonForm.venue}（レッスン日: ${date}）`,
    }))
    await supabase.from('transactions').insert(rows)
    setSaving(false)
    setShowLessonModal(false)
    setLessonForm(initLessonForm())
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

  const cumulativeData = useMemo(() => {
    let cum = 0
    return allYearlyTotals.map(y => {
      cum += y.income - y.expense
      return { ...y, profit: y.income - y.expense, cumulative: cum }
    })
  }, [allYearlyTotals])

  const totalCumulative = cumulativeData.length > 0 ? cumulativeData[cumulativeData.length - 1].cumulative : 0

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

  const categoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {}
    for (const t of transactions) {
      map[t.category] = (map[t.category] ?? 0) + t.amount
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [transactions])

  const availableYears = Array.from({ length: new Date().getFullYear() - 2002 + 5 }, (_, i) => 2002 + i)

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
              setLessonForm(initLessonForm())
              setShowLessonModal(true)
            }}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-sm transition-colors"
          >
            <Plus size={16} /> レッスン場代
          </button>
          <button
            onClick={() => {
              setForm({ transaction_date: new Date().toISOString().split('T')[0], type: 'income', category: INCOME_CATEGORIES[0], amount: '', description: '', lesson_date: '' })
              setShowModal(true)
            }}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-sm transition-colors"
          >
            <Plus size={16} /> 明細追加
          </button>
        </div>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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
        <div className={`rounded-xl shadow-sm p-4 ${totalCumulative >= 0 ? 'bg-purple-600' : 'bg-red-800'}`}>
          <div className="flex items-center gap-2 text-white/80 text-xs font-medium mb-2">
            <DollarSign size={14} /> 累計損益（全期間）
          </div>
          <div className="text-2xl font-bold text-white">¥{totalCumulative.toLocaleString()}</div>
          <div className="text-xs text-white/60 mt-1">
            {cumulativeData.length > 0 ? `${cumulativeData[0].year}〜${cumulativeData[cumulativeData.length - 1].year}年` : ''}
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

      {/* 年次推移・累計損益テーブル */}
      {cumulativeData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">年次推移・累計損益</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-100">
                  <th className="text-left pb-2 pr-3">年</th>
                  <th className="text-right pb-2 pr-3 text-green-600">収入</th>
                  <th className="text-right pb-2 pr-3 text-red-500">支出</th>
                  <th className="text-right pb-2 pr-3 text-indigo-600">年間損益</th>
                  <th className="text-right pb-2 text-purple-600 font-bold">累計損益</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {cumulativeData.map(row => (
                  <tr
                    key={row.year}
                    className={`${row.year === year ? 'bg-indigo-50 font-semibold' : 'hover:bg-gray-50'}`}
                    onClick={() => setYear(row.year)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td className="py-1.5 pr-3 text-gray-700">{row.year}年</td>
                    <td className="py-1.5 pr-3 text-right text-green-700">{row.income > 0 ? `¥${row.income.toLocaleString()}` : '—'}</td>
                    <td className="py-1.5 pr-3 text-right text-red-600">{row.expense > 0 ? `¥${row.expense.toLocaleString()}` : '—'}</td>
                    <td className={`py-1.5 pr-3 text-right ${row.profit >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>
                      {row.profit !== 0 ? `¥${row.profit.toLocaleString()}` : '—'}
                    </td>
                    <td className={`py-1.5 text-right font-bold ${row.cumulative >= 0 ? 'text-purple-700' : 'text-red-700'}`}>
                      ¥{row.cumulative.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 mt-3">行をクリックでその年の明細を表示</p>
        </div>
      )}

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
                          <td className="px-3 py-2.5 text-gray-400 hidden md:table-cell">
                            {(() => {
                              const sid = parseStudentId(t.description)
                              const sName = sid != null ? studentMap.get(sid) : null
                              return sName
                                ? <span className="text-indigo-600 font-medium text-xs">{sName}</span>
                                : <span className="text-xs">{t.description}</span>
                            })()}
                          </td>
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
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h2 className="text-lg font-bold text-gray-800">レッスン場代を追加</h2>
              <button onClick={() => setShowLessonModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="px-6 py-4 space-y-4">
              {/* カレンダー */}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-2">レッスン日（複数選択可）</label>
                <div className="border border-gray-200 rounded-xl p-3">
                  <MultiDateCalendar
                    selected={lessonForm.lesson_dates}
                    onChange={dates => setLessonForm(f => ({ ...f, lesson_dates: dates }))}
                  />
                </div>
                {lessonForm.lesson_dates.size > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {[...lessonForm.lesson_dates].sort().map(d => (
                      <span key={d} className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">{d}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* 支払日 */}
              <div>
                <label className="text-xs font-medium text-gray-600">支払日</label>
                <input
                  type="date"
                  value={lessonForm.payment_date}
                  onChange={e => setLessonForm(f => ({ ...f, payment_date: e.target.value }))}
                  className={`mt-1 ${inputCls}`}
                />
              </div>

              {/* 会場 */}
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

              {/* 金額 */}
              <div>
                <label className="text-xs font-medium text-gray-600">金額（円）/ 1レッスンあたり</label>
                <input
                  type="number"
                  value={lessonForm.amount}
                  onChange={e => setLessonForm(f => ({ ...f, amount: e.target.value }))}
                  className={`mt-1 ${inputCls}`}
                  placeholder="0"
                  min="1"
                />
              </div>

              {/* サマリー */}
              {lessonForm.lesson_dates.size > 0 && lessonForm.amount && Number(lessonForm.amount) > 0 && (
                <div className="bg-orange-50 rounded-xl px-4 py-3 text-sm">
                  <div className="text-orange-700 font-medium mb-1">登録内容</div>
                  <div className="text-xs text-gray-600 space-y-0.5">
                    <div>{lessonForm.lesson_dates.size}件のレッスン場代を追加</div>
                    <div>合計: <span className="font-bold text-orange-700">¥{(lessonForm.lesson_dates.size * Number(lessonForm.amount)).toLocaleString()}</span></div>
                    <div>種別: <span className="text-red-600 font-medium">支出</span> ／ カテゴリ: レッスン場代</div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-gray-100 sticky bottom-0 bg-white">
              <button onClick={() => setShowLessonModal(false)} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50">キャンセル</button>
              <button
                onClick={handleLessonSave}
                disabled={saving || lessonForm.lesson_dates.size === 0 || !lessonForm.amount || Number(lessonForm.amount) <= 0}
                className="flex-1 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white py-2.5 rounded-xl text-sm font-medium"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? '保存中...' : `${lessonForm.lesson_dates.size > 0 ? `${lessonForm.lesson_dates.size}件 ` : ''}追加する`}
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
              {form.category === 'レッスン場代' && (
                <div>
                  <label className="text-xs font-medium text-gray-600">レッスン日</label>
                  <input type="date" value={form.lesson_date} onChange={e => setForm(f => ({ ...f, lesson_date: e.target.value }))} className={`mt-1 ${inputCls}`} />
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-gray-600">内容・メモ</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={`mt-1 ${inputCls}`} placeholder={form.category === 'レッスン場代' ? DEFAULT_VENUE : ''} />
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
