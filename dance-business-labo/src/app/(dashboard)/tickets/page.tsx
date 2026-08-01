'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { TicketType, StudentTicket, Student, StudentPayment } from '@/types/database'
import { Plus, Pencil, Trash2, Ticket, AlertTriangle, CheckCircle, Clock, Search, X, Loader2, JapaneseYen } from 'lucide-react'

type Tab = 'issued' | 'types'

const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'

function RemainingBar({ used, total }: { used: number; total: number }) {
  const remaining = total - used
  const pct = total > 0 ? Math.round((remaining / total) * 100) : 0
  const color = remaining <= 0 ? 'bg-red-400' : remaining <= 2 ? 'bg-orange-400' : remaining <= 5 ? 'bg-yellow-400' : 'bg-green-400'
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 bg-gray-100 rounded-full h-1.5 min-w-[48px]">
        <div className={`h-1.5 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-bold whitespace-nowrap ${remaining <= 0 ? 'text-red-500' : remaining <= 2 ? 'text-orange-500' : remaining <= 5 ? 'text-yellow-600' : 'text-green-600'}`}>
        {remaining}/{total}
      </span>
    </div>
  )
}

function ExpiryBadge({ expiresAt }: { expiresAt: string | null }) {
  if (!expiresAt) return <span className="text-gray-400 text-xs">—</span>
  const diff = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (diff < 0) return <span className="inline-flex items-center gap-1 text-xs text-red-500 font-medium"><AlertTriangle size={11} />期限切れ</span>
  if (diff <= 30) return <span className="inline-flex items-center gap-1 text-xs text-orange-500 font-medium"><Clock size={11} />{diff}日後</span>
  return <span className="text-xs text-gray-500">{expiresAt}</span>
}

export default function TicketsPage() {
  const [tab, setTab] = useState<Tab>('issued')
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([])
  const [studentTickets, setStudentTickets] = useState<StudentTicket[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [pendingPayments, setPendingPayments] = useState<StudentPayment[]>([])
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // 検索・フィルター
  const [search, setSearch] = useState('')
  const [filterExpiry, setFilterExpiry] = useState<'all' | 'active' | 'expiring' | 'expired'>('all')

  // モーダル
  const [showTypeModal, setShowTypeModal] = useState(false)
  const [showIssueModal, setShowIssueModal] = useState(false)
  const [editingType, setEditingType] = useState<TicketType | null>(null)
  const [typeForm, setTypeForm] = useState({ name: '', total_count: '10', price: '10000', valid_days: '180' })
  const [issueForm, setIssueForm] = useState({
    student_id: '', ticket_type_id: '',
    purchased_at: new Date().toISOString().split('T')[0],
    custom_count: '', custom_price: '',
  })

  const supabase = createClient()

  async function load() {
    setLoading(true)
    const [{ data: tt }, { data: st }, { data: s }, { data: pp }] = await Promise.all([
      supabase.from('ticket_types').select('*').order('price'),
      supabase.from('student_tickets').select('*, students(name, name_kana), ticket_types(name)').order('expires_at'),
      supabase.from('students').select('*').eq('is_active', true).order('name_kana'),
      supabase.from('student_payments').select('*, students(name, name_kana)')
        .eq('payment_type', 'ticket_purchase').eq('status', 'pending')
        .order('payment_date', { ascending: false }),
    ])
    setTicketTypes(tt ?? [])
    setStudentTickets(st ?? [])
    setStudents(s ?? [])
    setPendingPayments(pp ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function confirmPayment(id: string) {
    setConfirmingId(id)
    await fetch(`/api/dashboard/payments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    })
    setConfirmingId(null)
    load()
  }

  // 統計
  const stats = useMemo(() => {
    const total = studentTickets.length
    const expired = studentTickets.filter(t => t.expires_at && new Date(t.expires_at) < new Date()).length
    const expiring = studentTickets.filter(t => {
      if (!t.expires_at) return false
      const diff = Math.ceil((new Date(t.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      return diff >= 0 && diff <= 30
    }).length
    const empty = studentTickets.filter(t => t.total_count - t.used_count <= 0).length
    return { total, expired, expiring, empty }
  }, [studentTickets])

  // フィルタリング
  const filteredTickets = useMemo(() => {
    let list = studentTickets
    if (search.trim()) {
      const q = search.trim()
      list = list.filter(t => {
        const sName = (t.students as { name: string; name_kana: string } | null)
        const tName = (t.ticket_types as { name: string } | null)
        return sName?.name.includes(q) || sName?.name_kana?.includes(q) || tName?.name.includes(q)
      })
    }
    if (filterExpiry === 'active') list = list.filter(t => !t.expires_at || new Date(t.expires_at) >= new Date())
    if (filterExpiry === 'expiring') list = list.filter(t => {
      if (!t.expires_at) return false
      const diff = Math.ceil((new Date(t.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      return diff >= 0 && diff <= 30
    })
    if (filterExpiry === 'expired') list = list.filter(t => t.expires_at && new Date(t.expires_at) < new Date())
    return list
  }, [studentTickets, search, filterExpiry])

  // チケット種別 保存
  async function saveType() {
    if (!typeForm.name.trim()) return
    setSaving(true)
    const payload = {
      name: typeForm.name,
      total_count: Number(typeForm.total_count),
      price: Number(typeForm.price),
      valid_days: Number(typeForm.valid_days),
    }
    if (editingType) {
      await supabase.from('ticket_types').update(payload).eq('id', editingType.id)
    } else {
      await supabase.from('ticket_types').insert(payload)
    }
    setSaving(false)
    setShowTypeModal(false)
    load()
  }

  async function deleteType(id: string) {
    if (!confirm('このチケット種別を削除しますか？')) return
    await supabase.from('ticket_types').delete().eq('id', id)
    load()
  }

  // チケット発行
  async function issueTicket() {
    const tt = ticketTypes.find(t => t.id === issueForm.ticket_type_id)
    if (!tt || !issueForm.student_id) return
    setSaving(true)
    const count = issueForm.custom_count ? Number(issueForm.custom_count) : tt.total_count
    const expiresAt = new Date(issueForm.purchased_at)
    expiresAt.setDate(expiresAt.getDate() + tt.valid_days)
    await supabase.from('student_tickets').insert({
      student_id: issueForm.student_id,
      ticket_type_id: issueForm.ticket_type_id,
      purchased_at: issueForm.purchased_at,
      expires_at: expiresAt.toISOString().split('T')[0],
      total_count: count,
      used_count: 0,
    })
    setSaving(false)
    setShowIssueModal(false)
    load()
  }

  async function deleteIssuedTicket(id: string, name: string) {
    if (!confirm(`「${name}」のチケットを削除しますか？`)) return
    await supabase.from('student_tickets').delete().eq('id', id)
    load()
  }

  const selectedTicketType = ticketTypes.find(t => t.id === issueForm.ticket_type_id)

  return (
    <div>
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">チケット管理</h1>
          <p className="text-gray-500 text-sm mt-0.5">発行済み {stats.total} 件</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setEditingType(null); setTypeForm({ name: '', total_count: '10', price: '10000', valid_days: '180' }); setShowTypeModal(true) }}
            className="flex items-center gap-2 border border-indigo-600 text-indigo-600 hover:bg-indigo-50 px-3 py-2 rounded-xl text-sm font-medium transition-colors"
          >
            <Plus size={15} /> 種別追加
          </button>
          <button
            onClick={() => { setIssueForm({ student_id: '', ticket_type_id: '', purchased_at: new Date().toISOString().split('T')[0], custom_count: '', custom_price: '' }); setShowIssueModal(true) }}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-xl text-sm font-medium shadow-sm transition-colors"
          >
            <Plus size={15} /> チケット発行
          </button>
        </div>
      </div>

      {/* 入金確認待ち（スタンプカード4回達成分など） */}
      {pendingPayments.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
          <h2 className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
            <JapaneseYen size={16} /> 入金確認待ち（{pendingPayments.length}件）
          </h2>
          <ul className="space-y-2">
            {pendingPayments.map(p => {
              const student = p.students as unknown as { name: string; name_kana: string } | null
              return (
                <li key={p.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 text-sm">
                  <div>
                    <span className="font-medium text-gray-800">{student?.name}</span>
                    <span className="text-gray-400 ml-2">¥{p.amount.toLocaleString()}</span>
                    {p.notes && <span className="text-gray-400 ml-2 text-xs">{p.notes}</span>}
                  </div>
                  <button
                    onClick={() => confirmPayment(p.id)}
                    disabled={confirmingId === p.id}
                    className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white px-3 py-1.5 rounded-lg text-xs font-medium"
                  >
                    {confirmingId === p.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                    入金確認
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* 統計カード */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { label: '発行済み', value: stats.total, icon: Ticket, color: 'bg-indigo-50 text-indigo-600', filter: 'all' },
          { label: '有効', value: stats.total - stats.expired, icon: CheckCircle, color: 'bg-green-50 text-green-600', filter: 'active' },
          { label: '期限30日以内', value: stats.expiring, icon: Clock, color: 'bg-orange-50 text-orange-500', filter: 'expiring' },
          { label: '期限切れ', value: stats.expired, icon: AlertTriangle, color: 'bg-red-50 text-red-500', filter: 'expired' },
        ].map(({ label, value, icon: Icon, color, filter }) => (
          <button
            key={filter}
            onClick={() => { setFilterExpiry(filter as typeof filterExpiry); setTab('issued') }}
            className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left w-full ${filterExpiry === filter && tab === 'issued' ? 'border-indigo-500 bg-indigo-50' : 'border-transparent bg-white hover:border-gray-200'} shadow-sm`}
          >
            <div className={`p-2 rounded-lg ${color}`}><Icon size={15} /></div>
            <div>
              <div className="text-xl font-bold text-gray-800">{value}</div>
              <div className="text-xs text-gray-500">{label}</div>
            </div>
          </button>
        ))}
      </div>

      {/* タブ */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-4 w-fit">
        {([['issued', '発行済みチケット'], ['types', 'チケット種別']] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 発行済みチケット タブ */}
      {tab === 'issued' && (
        <>
          {/* 検索・フィルター */}
          <div className="bg-white rounded-xl shadow-sm p-3 mb-4 flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
              <input
                type="text"
                placeholder="生徒名・チケット名で検索"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={14} /></button>}
            </div>
            <select
              value={filterExpiry}
              onChange={e => setFilterExpiry(e.target.value as typeof filterExpiry)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">すべて</option>
              <option value="active">有効のみ</option>
              <option value="expiring">期限30日以内</option>
              <option value="expired">期限切れ</option>
            </select>
          </div>

          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-gray-400">
                <Loader2 size={22} className="animate-spin mr-2" /> 読み込み中...
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">生徒名</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 hidden sm:table-cell">チケット種別</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">残枚数</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 hidden md:table-cell">有効期限</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 hidden lg:table-cell">購入日</th>
                    <th className="w-10 px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredTickets.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-12 text-gray-400">
                      <Ticket size={28} className="mx-auto mb-2 opacity-30" />
                      {search || filterExpiry !== 'all' ? '条件に一致するチケットがありません' : 'チケットが発行されていません'}
                    </td></tr>
                  )}
                  {filteredTickets.map(t => {
                    const student = t.students as { name: string; name_kana: string } | null
                    const ticketType = t.ticket_types as { name: string } | null
                    const isExpired = t.expires_at && new Date(t.expires_at) < new Date()
                    return (
                      <tr key={t.id} className={`hover:bg-gray-50 transition-colors ${isExpired ? 'opacity-60' : ''}`}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-800">{student?.name}</div>
                          {student?.name_kana && <div className="text-xs text-gray-400">{student.name_kana}</div>}
                          <div className="text-xs text-gray-400 sm:hidden mt-0.5">{ticketType?.name}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{ticketType?.name}</td>
                        <td className="px-4 py-3 w-32">
                          <RemainingBar used={t.used_count} total={t.total_count} />
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <ExpiryBadge expiresAt={t.expires_at} />
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs hidden lg:table-cell">{t.purchased_at}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => deleteIssuedTicket(t.id, student?.name ?? '')}
                            className="text-gray-300 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
            {!loading && filteredTickets.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-500">
                {filteredTickets.length} 件を表示
              </div>
            )}
          </div>
        </>
      )}

      {/* チケット種別 タブ */}
      {tab === 'types' && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {ticketTypes.length === 0 && !loading ? (
            <div className="text-center py-12 text-gray-400">
              <Ticket size={28} className="mx-auto mb-2 opacity-30" />
              チケット種別が登録されていません
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">チケット名</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">回数</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">価格</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 hidden md:table-cell">有効期間</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 hidden md:table-cell">1回単価</th>
                  <th className="w-20 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {ticketTypes.map(t => (
                  <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-800">{t.name}</td>
                    <td className="px-4 py-3 text-gray-600">{t.total_count}回</td>
                    <td className="px-4 py-3 text-gray-700 font-medium">¥{t.price.toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{t.valid_days}日間</td>
                    <td className="px-4 py-3 text-gray-500 text-xs hidden md:table-cell">
                      ¥{Math.round(t.price / t.total_count).toLocaleString()} / 回
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => { setEditingType(t); setTypeForm({ name: t.name, total_count: String(t.total_count), price: String(t.price), valid_days: String(t.valid_days) }); setShowTypeModal(true) }}
                        className="text-gray-400 hover:text-indigo-600 mr-1 p-1 rounded hover:bg-indigo-50 transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => deleteType(t.id)}
                        className="text-gray-400 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* チケット種別モーダル */}
      {showTypeModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">{editingType ? 'チケット種別を編集' : '新規チケット種別'}</h2>
              <button onClick={() => setShowTypeModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="px-6 py-4 space-y-3">
              {([
                ['チケット名 *', 'name', 'text', '例: 10回チケット'],
                ['回数', 'total_count', 'number', '10'],
                ['価格（円）', 'price', 'number', '10000'],
                ['有効日数', 'valid_days', 'number', '180'],
              ] as [string, keyof typeof typeForm, string, string][]).map(([label, key, type, placeholder]) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                  <input
                    type={type}
                    value={typeForm[key]}
                    onChange={e => setTypeForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className={inputCls}
                  />
                </div>
              ))}
              {typeForm.total_count && typeForm.price && Number(typeForm.total_count) > 0 && (
                <div className="bg-indigo-50 rounded-lg px-3 py-2 text-xs text-indigo-700">
                  1回単価: ¥{Math.round(Number(typeForm.price) / Number(typeForm.total_count)).toLocaleString()}
                </div>
              )}
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowTypeModal(false)} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50">キャンセル</button>
              <button onClick={saveType} disabled={saving} className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white py-2.5 rounded-xl text-sm font-medium">
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* チケット発行モーダル */}
      {showIssueModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">チケットを発行</h2>
              <button onClick={() => setShowIssueModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">生徒 *</label>
                <select
                  value={issueForm.student_id}
                  onChange={e => setIssueForm(f => ({ ...f, student_id: e.target.value }))}
                  className={inputCls}
                >
                  <option value="">生徒を選択</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.name}　{s.name_kana ? `（${s.name_kana}）` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">チケット種別 *</label>
                <select
                  value={issueForm.ticket_type_id}
                  onChange={e => setIssueForm(f => ({ ...f, ticket_type_id: e.target.value, custom_count: '' }))}
                  className={inputCls}
                >
                  <option value="">種別を選択</option>
                  {ticketTypes.map(t => <option key={t.id} value={t.id}>{t.name}（{t.total_count}回 / ¥{t.price.toLocaleString()}）</option>)}
                </select>
              </div>

              {/* 選択した種別の概要 */}
              {selectedTicketType && (
                <div className="bg-indigo-50 rounded-xl px-4 py-3 text-sm space-y-1">
                  <div className="flex justify-between text-indigo-700">
                    <span>回数</span>
                    <span className="font-medium">{issueForm.custom_count || selectedTicketType.total_count}回</span>
                  </div>
                  <div className="flex justify-between text-indigo-700">
                    <span>有効期間</span>
                    <span className="font-medium">{selectedTicketType.valid_days}日間</span>
                  </div>
                  <div className="flex justify-between text-indigo-700">
                    <span>価格</span>
                    <span className="font-medium">¥{selectedTicketType.price.toLocaleString()}</span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">購入日</label>
                <input
                  type="date"
                  value={issueForm.purchased_at}
                  onChange={e => setIssueForm(f => ({ ...f, purchased_at: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">回数を変更（任意）</label>
                <input
                  type="number"
                  value={issueForm.custom_count}
                  onChange={e => setIssueForm(f => ({ ...f, custom_count: e.target.value }))}
                  placeholder={`デフォルト: ${selectedTicketType?.total_count ?? '—'}回`}
                  className={inputCls}
                />
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowIssueModal(false)} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50">キャンセル</button>
              <button
                onClick={issueTicket}
                disabled={saving || !issueForm.student_id || !issueForm.ticket_type_id}
                className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white py-2.5 rounded-xl text-sm font-medium"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? '発行中...' : '発行する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
