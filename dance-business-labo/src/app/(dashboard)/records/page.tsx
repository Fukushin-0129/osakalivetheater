'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Student, StudentRecord } from '@/types/database'
import { Plus, Trash2, FileText, Pencil, Check, X, Search, Loader2, ChevronDown } from 'lucide-react'

export default function RecordsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [search, setSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [records, setRecords] = useState<StudentRecord[]>([])
  const [loadingRecords, setLoadingRecords] = useState(false)
  const [saving, setSaving] = useState(false)

  // 新規入力
  const [newContent, setNewContent] = useState('')
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0])

  // 編集中
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  const dropdownRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('students').select('id, name, name_kana').eq('is_active', true).order('name_kana')
      .then(({ data }) => setStudents(data as Student[] ?? []))
  }, [])

  // クリック外でドロップダウンを閉じる
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filteredStudents = students.filter(s =>
    !search || s.name.includes(search) || (s.name_kana ?? '').includes(search)
  )

  async function selectStudent(s: Student) {
    setSelectedStudent(s)
    setShowDropdown(false)
    setSearch('')
    setLoadingRecords(true)
    const { data } = await supabase.from('student_records').select('*').eq('student_id', s.id).order('record_date', { ascending: false })
    setRecords(data ?? [])
    setLoadingRecords(false)
  }

  async function addRecord() {
    if (!selectedStudent || !newContent.trim()) return
    setSaving(true)
    const { data } = await supabase
      .from('student_records')
      .insert({ student_id: selectedStudent.id, content: newContent.trim(), record_date: newDate })
      .select().single()
    if (data) setRecords(prev => [data, ...prev])
    setNewContent('')
    setNewDate(new Date().toISOString().split('T')[0])
    setSaving(false)
  }

  async function deleteRecord(id: string) {
    if (!confirm('この記録を削除しますか？')) return
    await supabase.from('student_records').delete().eq('id', id)
    setRecords(prev => prev.filter(r => r.id !== id))
  }

  async function saveEdit(id: string) {
    if (!editContent.trim()) return
    await supabase.from('student_records').update({ content: editContent.trim() }).eq('id', id)
    setRecords(prev => prev.map(r => r.id === id ? { ...r, content: editContent.trim() } : r))
    setEditingId(null)
  }

  function startEdit(r: StudentRecord) {
    setEditingId(r.id)
    setEditContent(r.content)
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">カルテ管理</h1>
        <p className="text-gray-500 text-sm mt-0.5">生徒ごとのレッスン記録・メモ</p>
      </div>

      {/* 生徒選択（検索付きドロップダウン） */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-4" ref={dropdownRef}>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">生徒を選択</label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowDropdown(v => !v)}
            className="w-full flex items-center justify-between border border-gray-200 rounded-xl px-3 py-2.5 text-sm hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white transition-colors"
          >
            {selectedStudent ? (
              <span className="font-medium text-gray-800">
                {selectedStudent.name}
                {selectedStudent.name_kana && <span className="text-gray-400 font-normal ml-2 text-xs">{selectedStudent.name_kana}</span>}
              </span>
            ) : (
              <span className="text-gray-400">生徒を選んでください</span>
            )}
            <ChevronDown size={16} className={`text-gray-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
          </button>

          {showDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-30 overflow-hidden">
              <div className="p-2 border-b border-gray-100">
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    autoFocus
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="名前・よみがなで絞り込み"
                    className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="max-h-56 overflow-y-auto">
                {filteredStudents.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-gray-400 text-center">見つかりません</div>
                ) : (
                  filteredStudents.map(s => (
                    <button
                      key={s.id}
                      onClick={() => selectStudent(s)}
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-indigo-50 transition-colors flex items-center justify-between ${selectedStudent?.id === s.id ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700'}`}
                    >
                      <span>{s.name}</span>
                      {s.name_kana && <span className="text-xs text-gray-400 ml-2">{s.name_kana}</span>}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedStudent && (
        <div className="grid lg:grid-cols-[1fr_320px] gap-4 items-start">
          {/* 記録一覧 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">
                記録一覧
                {!loadingRecords && <span className="text-gray-400 font-normal ml-1">（{records.length}件）</span>}
              </h2>
            </div>

            {loadingRecords ? (
              <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-400">
                <Loader2 size={22} className="animate-spin mx-auto" />
              </div>
            ) : records.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm p-10 text-center text-gray-400">
                <FileText size={30} className="mx-auto mb-2 opacity-20" />
                <p className="text-sm">記録がありません</p>
                <p className="text-xs mt-1">右側のフォームから最初の記録を追加してください</p>
              </div>
            ) : (
              records.map(r => (
                <div key={r.id} className="bg-white rounded-xl shadow-sm p-4 group">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
                      {new Date(r.record_date + 'T00:00:00').toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
                    </span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {editingId === r.id ? (
                        <>
                          <button onClick={() => saveEdit(r.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"><Check size={14} /></button>
                          <button onClick={() => setEditingId(null)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"><X size={14} /></button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(r)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Pencil size={14} /></button>
                          <button onClick={() => deleteRecord(r.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14} /></button>
                        </>
                      )}
                    </div>
                  </div>

                  {editingId === r.id ? (
                    <textarea
                      value={editContent}
                      onChange={e => setEditContent(e.target.value)}
                      rows={4}
                      autoFocus
                      className="w-full border border-indigo-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  ) : (
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{r.content}</p>
                  )}
                </div>
              ))
            )}
          </div>

          {/* 新規追加フォーム（右カラム・sticky） */}
          <div className="bg-white rounded-xl shadow-sm p-4 lg:sticky lg:top-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Plus size={15} className="text-indigo-500" /> 新規記録を追加
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">記録日</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={e => setNewDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">内容</label>
                <textarea
                  value={newContent}
                  onChange={e => setNewContent(e.target.value)}
                  rows={6}
                  placeholder={`${selectedStudent.name}さんのレッスン内容、身体の状態、課題、気づきなど...`}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
                <p className="text-right text-xs text-gray-400 mt-0.5">{newContent.length}文字</p>
              </div>
              <button
                onClick={addRecord}
                disabled={saving || !newContent.trim()}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                {saving ? '保存中...' : '記録を追加'}
              </button>
            </div>
          </div>
        </div>
      )}

      {!selectedStudent && (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-400">
          <FileText size={36} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">上のセレクトから生徒を選んでください</p>
        </div>
      )}
    </div>
  )
}
