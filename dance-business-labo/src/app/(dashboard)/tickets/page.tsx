'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { TicketType, StudentTicket, Student } from '@/types/database'
import { Plus, Pencil, Trash2 } from 'lucide-react'

export default function TicketsPage() {
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([])
  const [studentTickets, setStudentTickets] = useState<StudentTicket[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [showTypeModal, setShowTypeModal] = useState(false)
  const [showIssueModal, setShowIssueModal] = useState(false)
  const [editingType, setEditingType] = useState<TicketType | null>(null)
  const [typeForm, setTypeForm] = useState({ name: '', total_count: '10', price: '10000', valid_days: '180' })
  const [issueForm, setIssueForm] = useState({ student_id: '', ticket_type_id: '', purchased_at: new Date().toISOString().split('T')[0] })
  const supabase = createClient()

  async function load() {
    const [{ data: tt }, { data: st }, { data: s }] = await Promise.all([
      supabase.from('ticket_types').select('*').order('name'),
      supabase.from('student_tickets').select('*, students(name), ticket_types(name)').order('purchased_at', { ascending: false }),
      supabase.from('students').select('*').eq('is_active', true).order('name_kana'),
    ])
    setTicketTypes(tt ?? [])
    setStudentTickets(st ?? [])
    setStudents(s ?? [])
  }

  useEffect(() => { load() }, [])

  async function saveType() {
    const payload = { name: typeForm.name, total_count: Number(typeForm.total_count), price: Number(typeForm.price), valid_days: Number(typeForm.valid_days) }
    if (editingType) {
      await supabase.from('ticket_types').update(payload).eq('id', editingType.id)
    } else {
      await supabase.from('ticket_types').insert(payload)
    }
    setShowTypeModal(false)
    load()
  }

  async function deleteType(id: string) {
    if (!confirm('このチケット種別を削除しますか？')) return
    await supabase.from('ticket_types').delete().eq('id', id)
    load()
  }

  async function issueTicket() {
    const tt = ticketTypes.find(t => t.id === issueForm.ticket_type_id)
    if (!tt || !issueForm.student_id) return
    const expiresAt = new Date(issueForm.purchased_at)
    expiresAt.setDate(expiresAt.getDate() + tt.valid_days)
    await supabase.from('student_tickets').insert({
      student_id: issueForm.student_id,
      ticket_type_id: issueForm.ticket_type_id,
      purchased_at: issueForm.purchased_at,
      expires_at: expiresAt.toISOString().split('T')[0],
      total_count: tt.total_count,
      used_count: 0,
    })
    setShowIssueModal(false)
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">チケット管理</h1>
        <div className="flex gap-2">
          <button onClick={() => { setEditingType(null); setTypeForm({ name: '', total_count: '10', price: '10000', valid_days: '180' }); setShowTypeModal(true) }}
            className="flex items-center gap-2 border border-indigo-600 text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-lg text-sm font-medium">
            <Plus size={16} /> チケット種別
          </button>
          <button onClick={() => { setIssueForm({ student_id: '', ticket_type_id: '', purchased_at: new Date().toISOString().split('T')[0] }); setShowIssueModal(true) }}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
            <Plus size={16} /> チケット発行
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
        <div className="px-4 py-3 bg-gray-50 text-xs font-semibold text-gray-600">チケット種別</div>
        <table className="w-full text-sm">
          <thead className="text-gray-500 text-xs border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-2">名称</th>
              <th className="text-left px-4 py-2">枚数</th>
              <th className="text-left px-4 py-2">価格</th>
              <th className="text-left px-4 py-2 hidden md:table-cell">有効期間</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {ticketTypes.length === 0 && <tr><td colSpan={5} className="text-center py-6 text-gray-400">チケット種別なし</td></tr>}
            {ticketTypes.map(t => (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{t.name}</td>
                <td className="px-4 py-3 text-gray-600">{t.total_count}回</td>
                <td className="px-4 py-3 text-gray-600">¥{t.price.toLocaleString()}</td>
                <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{t.valid_days}日</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => { setEditingType(t); setTypeForm({ name: t.name, total_count: String(t.total_count), price: String(t.price), valid_days: String(t.valid_days) }); setShowTypeModal(true) }} className="text-gray-400 hover:text-indigo-600 mr-2"><Pencil size={15} /></button>
                  <button onClick={() => deleteType(t.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={15} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 text-xs font-semibold text-gray-600">発行済みチケット</div>
        <table className="w-full text-sm">
          <thead className="text-gray-500 text-xs border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-2">生徒名</th>
              <th className="text-left px-4 py-2">チケット</th>
              <th className="text-left px-4 py-2">残回数</th>
              <th className="text-left px-4 py-2 hidden md:table-cell">有効期限</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {studentTickets.length === 0 && <tr><td colSpan={4} className="text-center py-6 text-gray-400">発行済みチケットなし</td></tr>}
            {studentTickets.map(t => {
              const remaining = t.total_count - t.used_count
              return (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{(t.students as { name: string } | null)?.name}</td>
                  <td className="px-4 py-3 text-gray-600">{(t.ticket_types as { name: string } | null)?.name}</td>
                  <td className="px-4 py-3">
                    <span className={`font-bold ${remaining <= 0 ? 'text-red-500' : remaining <= 3 ? 'text-orange-500' : 'text-indigo-600'}`}>{remaining}回</span>
                    <span className="text-gray-400 text-xs ml-1">/ {t.total_count}回</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{t.expires_at}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {showTypeModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold mb-4">{editingType ? 'チケット種別を編集' : '新規チケット種別'}</h2>
            <div className="space-y-3">
              {[['名称', 'name', 'text'], ['回数', 'total_count', 'number'], ['価格（円）', 'price', 'number'], ['有効日数', 'valid_days', 'number']].map(([label, key, type]) => (
                <div key={key}>
                  <label className="text-xs font-medium text-gray-600">{label}</label>
                  <input type={type} value={typeForm[key as keyof typeof typeForm]} onChange={e => setTypeForm(f => ({ ...f, [key]: e.target.value }))} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowTypeModal(false)} className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg text-sm">キャンセル</button>
              <button onClick={saveType} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-sm font-medium">保存</button>
            </div>
          </div>
        </div>
      )}

      {showIssueModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold mb-4">チケット発行</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600">生徒</label>
                <select value={issueForm.student_id} onChange={e => setIssueForm(f => ({ ...f, student_id: e.target.value }))} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">選択してください</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">チケット種別</label>
                <select value={issueForm.ticket_type_id} onChange={e => setIssueForm(f => ({ ...f, ticket_type_id: e.target.value }))} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">選択してください</option>
                  {ticketTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">購入日</label>
                <input type="date" value={issueForm.purchased_at} onChange={e => setIssueForm(f => ({ ...f, purchased_at: e.target.value }))} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowIssueModal(false)} className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg text-sm">キャンセル</button>
              <button onClick={issueTicket} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-sm font-medium">発行</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
