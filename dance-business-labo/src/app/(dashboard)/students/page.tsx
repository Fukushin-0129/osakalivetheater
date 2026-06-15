'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Student } from '@/types/database'
import { Plus, Search, Pencil, Trash2, Users, UserCheck, UserMinus, ChevronUp, ChevronDown, X, Loader2 } from 'lucide-react'
import Link from 'next/link'

type SortKey = 'name_kana' | 'joined_at' | 'name'
type SortDir = 'asc' | 'desc'
type FilterStatus = 'all' | 'active' | 'inactive'

const INIT_FORM = {
  name: '', name_kana: '', email: '', phone: '',
  birthdate: '', address: '', emergency_contact: '', notes: '',
  legacy_id: '' as string | number,
  is_active: true,
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [lastAttendedMap, setLastAttendedMap] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [sortKey, setSortKey] = useState<SortKey>('name_kana')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Student | null>(null)
  const [form, setForm] = useState(INIT_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const supabase = createClient()

  async function load() {
    setLoading(true)
    const [{ data: stuData }, { data: attData }] = await Promise.all([
      supabase.from('students').select('*'),
      supabase.from('attendance').select('student_id, lessons(scheduled_at)').eq('status', 'present'),
    ])
    setStudents(stuData ?? [])
    const map = new Map<string, string>()
    for (const a of (attData ?? []) as { student_id: string; lessons: { scheduled_at: string } | null }[]) {
      const date = a.lessons?.scheduled_at?.slice(0, 10)
      if (!date) continue
      const prev = map.get(a.student_id)
      if (!prev || date > prev) map.set(a.student_id, date)
    }
    setLastAttendedMap(map)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openNew() {
    setEditing(null)
    setForm(INIT_FORM)
    setFormError(null)
    setShowModal(true)
  }

  function openEdit(s: Student) {
    setEditing(s)
    setForm({
      name: s.name,
      name_kana: s.name_kana ?? '',
      email: s.email ?? '',
      phone: s.phone ?? '',
      birthdate: s.birthdate ?? '',
      address: s.address ?? '',
      emergency_contact: s.emergency_contact ?? '',
      notes: s.notes ?? '',
      legacy_id: s.legacy_id ?? '',
      is_active: s.is_active,
    })
    setFormError(null)
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.name.trim()) { setFormError('名前は必須です'); return }
    setSaving(true)
    setFormError(null)
    const payload = {
      ...form,
      legacy_id: form.legacy_id !== '' ? Number(form.legacy_id) : null,
    }
    if (editing) {
      await supabase.from('students').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editing.id)
    } else {
      await supabase.from('students').insert({ ...payload })
    }
    setSaving(false)
    setShowModal(false)
    load()
  }

  async function handleDelete(s: Student) {
    if (!confirm(`「${s.name}」を削除しますか？\nこの操作は取り消せません。`)) return
    await supabase.from('students').delete().eq('id', s.id)
    load()
  }

  async function toggleActive(s: Student) {
    await supabase.from('students').update({ is_active: !s.is_active, updated_at: new Date().toISOString() }).eq('id', s.id)
    setStudents(prev => prev.map(p => p.id === s.id ? { ...p, is_active: !s.is_active } : p))
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const filtered = useMemo(() => {
    let list = students
    if (filterStatus === 'active') list = list.filter(s => s.is_active)
    if (filterStatus === 'inactive') list = list.filter(s => !s.is_active)
    if (search.trim()) {
      const q = search.trim()
      list = list.filter(s =>
        s.name.includes(q) ||
        (s.name_kana ?? '').includes(q) ||
        (s.email ?? '').includes(q) ||
        (s.phone ?? '').includes(q)
      )
    }
    list = [...list].sort((a, b) => {
      // 在籍メンバーを先に、休会メンバーを後ろに
      if (a.is_active !== b.is_active) return a.is_active ? -1 : 1
      // 同じステータス内は最後に来た日の新しい順
      const aDate = lastAttendedMap.get(a.id) ?? ''
      const bDate = lastAttendedMap.get(b.id) ?? ''
      if (aDate !== bDate) return bDate.localeCompare(aDate)
      // 最後に来た日が同じ場合はよみがな順
      return (a.name_kana ?? a.name).localeCompare(b.name_kana ?? b.name, 'ja')
    })
    return list
  }, [students, search, filterStatus, lastAttendedMap])

  const activeCount = students.filter(s => s.is_active).length
  const inactiveCount = students.filter(s => !s.is_active).length

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronUp size={12} className="text-gray-300" />
    return sortDir === 'asc'
      ? <ChevronUp size={12} className="text-indigo-500" />
      : <ChevronDown size={12} className="text-indigo-500" />
  }

  return (
    <div>
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">生徒管理</h1>
          <p className="text-gray-500 text-sm mt-0.5">全 {students.length} 名（在籍 {activeCount} 名 / 休会 {inactiveCount} 名）</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-sm transition-colors"
        >
          <Plus size={16} /> 新規追加
        </button>
      </div>

      {/* 統計カード */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: '全生徒', count: students.length, icon: Users, color: 'bg-indigo-50 text-indigo-600', filter: 'all' },
          { label: '在籍中', count: activeCount, icon: UserCheck, color: 'bg-green-50 text-green-600', filter: 'active' },
          { label: '休会中', count: inactiveCount, icon: UserMinus, color: 'bg-gray-50 text-gray-500', filter: 'inactive' },
        ].map(({ label, count, icon: Icon, color, filter }) => (
          <button
            key={filter}
            onClick={() => setFilterStatus(filter as FilterStatus)}
            className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${filterStatus === filter ? 'border-indigo-500 bg-indigo-50' : 'border-transparent bg-white hover:border-gray-200'} shadow-sm`}
          >
            <div className={`p-2 rounded-lg ${color}`}><Icon size={16} /></div>
            <div>
              <div className="text-lg font-bold text-gray-800">{count}</div>
              <div className="text-xs text-gray-500">{label}</div>
            </div>
          </button>
        ))}
      </div>

      {/* 検索 */}
      <div className="bg-white rounded-xl shadow-sm p-3 mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
          <input
            type="text"
            placeholder="名前・よみがな・電話番号・メールで検索"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* テーブル */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 size={24} className="animate-spin mr-2" /> 読み込み中...
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3">
                  <button onClick={() => handleSort('name_kana')} className="flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-gray-800">
                    名前 <SortIcon col="name_kana" />
                  </button>
                </th>
                <th className="text-left px-4 py-3 hidden md:table-cell text-xs font-semibold text-gray-600">参加者ID</th>
                <th className="text-left px-4 py-3 hidden md:table-cell text-xs font-semibold text-gray-600">電話番号</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell text-xs font-semibold text-gray-600">メール</th>
                <th className="text-left px-4 py-3 hidden md:table-cell text-xs font-semibold text-gray-600">最終来院日</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">状態</th>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400">
                    <Users size={32} className="mx-auto mb-2 opacity-30" />
                    {search ? '検索条件に一致する生徒が見つかりません' : '生徒が登録されていません'}
                  </td>
                </tr>
              )}
              {filtered.map(s => (
                <tr key={s.id} className={`hover:bg-gray-50 transition-colors ${!s.is_active ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3">
                    <Link href={`/students/${s.id}`} className="font-medium text-indigo-600 hover:underline">
                      {s.name}
                    </Link>
                    {s.name_kana && <div className="text-xs text-gray-400 mt-0.5">{s.name_kana}</div>}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {s.legacy_id != null
                      ? <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-mono">#{s.legacy_id}</span>
                      : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell text-sm">{s.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500 hidden lg:table-cell text-sm">{s.email ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs hidden md:table-cell">{lastAttendedMap.get(s.id) ?? '—'}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(s)}
                      title={s.is_active ? 'クリックで休会に変更' : 'クリックで在籍に変更'}
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                        s.is_active
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {s.is_active ? '在籍' : '休会'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(s)} className="text-gray-400 hover:text-indigo-600 mr-2 p-1 rounded hover:bg-indigo-50 transition-colors">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => handleDelete(s)} className="text-gray-400 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* フッター */}
        {!loading && filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-500">
            {filtered.length} 名を表示
            {search && <span className="ml-1">（「{search}」で絞り込み）</span>}
          </div>
        )}
      </div>

      {/* 追加・編集モーダル */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] flex flex-col">
            {/* モーダルヘッダー */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <h2 className="text-lg font-bold text-gray-800">
                {editing ? '生徒情報を編集' : '新規生徒を追加'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={20} />
              </button>
            </div>

            {/* モーダルボディ（スクロール） */}
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Field label="名前 *">
                    <input
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="山田 花子"
                      className={inputCls}
                    />
                  </Field>
                </div>
                <div className="col-span-2">
                  <Field label="よみがな">
                    <input
                      value={form.name_kana}
                      onChange={e => setForm(f => ({ ...f, name_kana: e.target.value }))}
                      placeholder="やまだ はなこ"
                      className={inputCls}
                    />
                  </Field>
                </div>
                <Field label="メールアドレス">
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="example@email.com"
                    className={inputCls}
                  />
                </Field>
                <Field label="電話番号">
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="090-0000-0000"
                    className={inputCls}
                  />
                </Field>
                <Field label="生年月日">
                  <input
                    type="date"
                    value={form.birthdate}
                    onChange={e => setForm(f => ({ ...f, birthdate: e.target.value }))}
                    className={inputCls}
                  />
                </Field>
                <Field label="参加者ID（旧システム）">
                  <input
                    type="number"
                    value={form.legacy_id}
                    onChange={e => setForm(f => ({ ...f, legacy_id: e.target.value }))}
                    placeholder="例: 899"
                    className={inputCls}
                  />
                </Field>
                <Field label="入会状態">
                  <select
                    value={form.is_active ? 'true' : 'false'}
                    onChange={e => setForm(f => ({ ...f, is_active: e.target.value === 'true' }))}
                    className={inputCls}
                  >
                    <option value="true">在籍</option>
                    <option value="false">休会</option>
                  </select>
                </Field>
                <div className="col-span-2">
                  <Field label="住所">
                    <input
                      value={form.address}
                      onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                      placeholder="大阪府大阪市..."
                      className={inputCls}
                    />
                  </Field>
                </div>
                <div className="col-span-2">
                  <Field label="緊急連絡先">
                    <input
                      value={form.emergency_contact}
                      onChange={e => setForm(f => ({ ...f, emergency_contact: e.target.value }))}
                      placeholder="山田 太郎（父）090-0000-0000"
                      className={inputCls}
                    />
                  </Field>
                </div>
                <div className="col-span-2">
                  <Field label="備考">
                    <textarea
                      value={form.notes}
                      onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                      rows={3}
                      placeholder="アレルギー・持病・その他連絡事項など"
                      className={inputCls}
                    />
                  </Field>
                </div>
              </div>

              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg flex items-center gap-2">
                  <span>⚠️</span> {formError}
                </div>
              )}
            </div>

            {/* モーダルフッター */}
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? '保存中...' : editing ? '更新する' : '追加する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
