'use client'

import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Student } from '@/types/database'
import { Plus, Search, Pencil, Trash2, Users, UserCheck, UserMinus, X, Loader2, Camera, Check, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import Link from 'next/link'
import ReactCrop, { type Crop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'

type FilterStatus = 'all' | 'active' | 'inactive'
type SortKey = 'name' | 'legacy_id' | 'phone' | 'joined_at' | 'lastAttended' | 'lastKarte' | 'status'

const INIT_FORM = {
  name: '', name_kana: '', email: '', phone: '',
  birthdate: '', joined_at: '', postal_code: '',
  address1: '', address2: '', address3: '',
  emergency_contact: '', notes: '',
  legacy_id: '' as string | number,
  is_active: true,
  subsidy_program: '',
  contact_method: '',
  contact_detail: '',
  contact_response_level: '' as string | number,
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

function SortTh({ label, active, dir, onClick, className }: { label: string; active: boolean; dir: 'asc' | 'desc'; onClick: () => void; className?: string }) {
  return (
    <th className={`text-left px-4 py-3 text-xs font-semibold text-gray-600 ${className ?? ''}`}>
      <button onClick={onClick} className={`flex items-center gap-1 hover:text-indigo-600 ${active ? 'text-indigo-600' : ''}`}>
        {label}
        {active ? (dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} className="text-gray-300" />}
      </button>
    </th>
  )
}

const RESPONSE_LEVEL_LABEL: Record<number, string> = {
  0: '連絡先不明',
  1: '無反応',
  2: 'やや反応',
  3: '反応あり',
}
const RESPONSE_LEVEL_STYLE: Record<number, string> = {
  0: 'bg-red-100 text-red-700',
  1: 'bg-orange-100 text-orange-700',
  2: 'bg-yellow-100 text-yellow-700',
  3: 'bg-green-100 text-green-700',
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [lastAttendedMap, setLastAttendedMap] = useState<Map<string, string>>(new Map())
  const [lastKarteMap, setLastKarteMap] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState(() => (typeof window !== 'undefined' ? sessionStorage.getItem('studentsPage:search') ?? '' : ''))
  const [filterStatus, setFilterStatus] = useState<FilterStatus>(() => {
    if (typeof window === 'undefined') return 'all'
    const saved = sessionStorage.getItem('studentsPage:filter')
    return (saved === 'active' || saved === 'inactive' || saved === 'all') ? saved : 'all'
  })
  const [sortKey, setSortKey] = useState<SortKey | null>(() => (typeof window !== 'undefined' ? (sessionStorage.getItem('studentsPage:sortKey') as SortKey | null) : null))
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(() => (typeof window !== 'undefined' && sessionStorage.getItem('studentsPage:sortDir') === 'desc') ? 'desc' : 'asc')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Student | null>(null)
  const [form, setForm] = useState(INIT_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [signedAvatarMap, setSignedAvatarMap] = useState<Map<string, string>>(new Map())
  const [zipLoading, setZipLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState<Crop>()
  const [cropFileName, setCropFileName] = useState('')
  const [originalDataUrl, setOriginalDataUrl] = useState<string | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const supabase = createClient()

  async function load() {
    setLoading(true)
    const [{ data: stuData }, { data: attData }, { data: karteData }] = await Promise.all([
      supabase.from('students').select('*'),
      supabase.rpc('get_last_attended_dates'),
      supabase.from('student_records').select('student_id, record_date').order('record_date', { ascending: false }),
    ])
    const stuList = stuData ?? []
    setStudents(stuList)

    // プライベートバケットの署名付きURL（1時間有効）を取得
    const paths = stuList.filter(s => s.avatar_url && !s.avatar_url.startsWith('http')).map(s => s.avatar_url!)
    if (paths.length > 0) {
      const { data: signed } = await supabase.storage.from('student-avatars').createSignedUrls(paths, 3600)
      const avatarMap = new Map<string, string>()
      for (const s of stuList) {
        const entry = signed?.find(u => u.path === s.avatar_url)
        if (entry?.signedUrl) avatarMap.set(s.id, entry.signedUrl)
      }
      setSignedAvatarMap(avatarMap)
    }

    const map = new Map<string, string>()
    for (const a of (attData ?? []) as { student_id: string; last_attended: string }[]) {
      if (a.last_attended) map.set(a.student_id, a.last_attended)
    }
    setLastAttendedMap(map)

    const karteMap = new Map<string, string>()
    for (const r of (karteData ?? []) as { student_id: string; record_date: string }[]) {
      if (!karteMap.has(r.student_id)) karteMap.set(r.student_id, r.record_date)
    }
    setLastKarteMap(karteMap)

    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // 検索・絞り込みの条件を覚えておき、詳細ページから戻ってきた時に復元する
  useEffect(() => { sessionStorage.setItem('studentsPage:search', search) }, [search])
  useEffect(() => { sessionStorage.setItem('studentsPage:filter', filterStatus) }, [filterStatus])
  useEffect(() => { sessionStorage.setItem('studentsPage:sortKey', sortKey ?? '') }, [sortKey])
  useEffect(() => { sessionStorage.setItem('studentsPage:sortDir', sortDir) }, [sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  // 一覧の読み込みが終わったら、直前に見ていたスクロール位置へ戻す
  useEffect(() => {
    if (loading) return
    const saved = sessionStorage.getItem('studentsPage:scrollY')
    if (saved) requestAnimationFrame(() => window.scrollTo(0, Number(saved)))
  }, [loading])

  useEffect(() => {
    function saveScroll() { sessionStorage.setItem('studentsPage:scrollY', String(window.scrollY)) }
    window.addEventListener('scroll', saveScroll, { passive: true })
    return () => window.removeEventListener('scroll', saveScroll)
  }, [])

  function openNew() {
    setEditing(null)
    setForm(INIT_FORM)
    setFormError(null)
    setAvatarFile(null)
    setAvatarPreview(null)
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
      joined_at: s.joined_at ?? '',
      postal_code: s.postal_code ?? '',
      address1: s.address1 ?? s.address ?? '',
      address2: s.address2 ?? '',
      address3: s.address3 ?? '',
      emergency_contact: s.emergency_contact ?? '',
      notes: s.notes ?? '',
      legacy_id: s.legacy_id ?? '',
      is_active: s.is_active,
      subsidy_program: s.subsidy_program ?? '',
      contact_method: s.contact_method ?? '',
      contact_detail: s.contact_detail ?? '',
      contact_response_level: s.contact_response_level ?? '',
    })
    setFormError(null)
    setAvatarFile(null)
    setAvatarPreview(signedAvatarMap.get(s.id) ?? null)
    setShowModal(true)
  }

  async function lookupZip(zip: string) {
    const z = zip.replace(/[^\d]/g, '')
    if (z.length !== 7) return
    setZipLoading(true)
    try {
      const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${z}`)
      const json = await res.json()
      if (json.results?.[0]) {
        const r = json.results[0]
        setForm(f => ({ ...f, address1: r.address1 + r.address2 + r.address3 }))
      }
    } catch {
      // ignore
    } finally {
      setZipLoading(false)
    }
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCropFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      // 取り込んだ画像はそのまま使用する（トリミングは任意で後から選択）
      setOriginalDataUrl(dataUrl)
      setAvatarFile(file)
      setAvatarPreview(dataUrl)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function openCropTool() {
    if (originalDataUrl) setCropSrc(originalDataUrl)
  }

  function onCropImageLoad() {
    // 切り取りツールを開いた時は、デフォルトで画像全体を選択しておく
    setCrop({ unit: '%', x: 0, y: 0, width: 100, height: 100 })
  }

  const confirmCrop = useCallback(() => {
    if (!imgRef.current || !crop) return
    const canvas = document.createElement('canvas')
    const scaleX = imgRef.current.naturalWidth / imgRef.current.width
    const scaleY = imgRef.current.naturalHeight / imgRef.current.height
    const pixelRatio = window.devicePixelRatio || 1
    const cropW = (crop.unit === '%' ? crop.width / 100 * imgRef.current.width : crop.width)
    const cropH = (crop.unit === '%' ? crop.height / 100 * imgRef.current.height : crop.height)
    const cropX = (crop.unit === '%' ? crop.x / 100 * imgRef.current.width : crop.x)
    const cropY = (crop.unit === '%' ? crop.y / 100 * imgRef.current.height : crop.y)
    canvas.width = cropW * scaleX * pixelRatio
    canvas.height = cropH * scaleY * pixelRatio
    const ctx = canvas.getContext('2d')!
    ctx.scale(pixelRatio, pixelRatio)
    ctx.drawImage(
      imgRef.current,
      cropX * scaleX, cropY * scaleY,
      cropW * scaleX, cropH * scaleY,
      0, 0, cropW * scaleX, cropH * scaleY
    )
    canvas.toBlob(blob => {
      if (!blob) return
      const ext = cropFileName.split('.').pop() ?? 'jpg'
      const file = new File([blob], cropFileName, { type: `image/${ext === 'png' ? 'png' : 'jpeg'}` })
      setAvatarFile(file)
      setAvatarPreview(URL.createObjectURL(blob))
      setCropSrc(null)
    }, 'image/jpeg', 0.9)
  }, [crop, cropFileName])


  async function uploadAvatar(file: File, studentId: string): Promise<string | null> {
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${studentId}/avatar.${ext}`
    const { error } = await supabase.storage.from('student-avatars').upload(path, file, { upsert: true })
    if (error) return null
    return path  // パスのみ保存（フルURLではない）
  }

  async function handleSave() {
    if (!form.name.trim()) { setFormError('名前は必須です'); return }
    setSaving(true)
    setFormError(null)
    try {
      const payload = {
        ...form,
        legacy_id: form.legacy_id !== '' ? Number(form.legacy_id) : null,
        joined_at: form.joined_at || null,
        birthdate: form.birthdate || null,
        postal_code: form.postal_code || null,
        address1: form.address1 || null,
        address2: form.address2 || null,
        address3: form.address3 || null,
        subsidy_program: form.subsidy_program || null,
        contact_method: form.contact_method || null,
        contact_detail: form.contact_detail || null,
        contact_response_level: form.contact_response_level !== '' ? Number(form.contact_response_level) : null,
      }

      let studentId: string = editing?.id ?? ''
      if (editing) {
        const { error } = await supabase.from('students').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editing.id)
        if (error) { setFormError(`保存に失敗しました: ${error.message}`); return }
      } else {
        const { data, error } = await supabase.from('students').insert({ ...payload }).select('id').single()
        if (error) { setFormError(`追加に失敗しました: ${error.message}`); return }
        studentId = data?.id ?? ''
      }

      if (avatarFile && studentId) {
        const url = await uploadAvatar(avatarFile, studentId)
        if (url) await supabase.from('students').update({ avatar_url: url, updated_at: new Date().toISOString() }).eq('id', studentId)
      }

      setShowModal(false)
      setAvatarFile(null)
      setAvatarPreview(null)
      load()
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('Failed to save student:', e)
      setFormError(`予期しないエラーが発生しました: ${message}`)
    } finally {
      setSaving(false)
    }
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
    if (sortKey) {
      const dir = sortDir === 'asc' ? 1 : -1
      const getValue = (s: Student): string | number => {
        switch (sortKey) {
          case 'name': return s.name_kana ?? s.name
          case 'legacy_id': return s.legacy_id ?? Infinity
          case 'phone': return s.phone ?? ''
          case 'joined_at': return s.joined_at ?? ''
          case 'lastAttended': return lastAttendedMap.get(s.id) ?? ''
          case 'lastKarte': return lastKarteMap.get(s.id) ?? ''
          case 'status': return s.is_active ? 1 : 0
        }
      }
      list = [...list].sort((a, b) => {
        const av = getValue(a)
        const bv = getValue(b)
        const aEmpty = av === '' || av === Infinity
        const bEmpty = bv === '' || bv === Infinity
        if (aEmpty !== bEmpty) return aEmpty ? 1 : -1
        if (av < bv) return -1 * dir
        if (av > bv) return 1 * dir
        return (a.name_kana ?? a.name).localeCompare(b.name_kana ?? b.name, 'ja')
      })
    } else {
      list = [...list].sort((a, b) => {
        if (a.is_active !== b.is_active) return a.is_active ? -1 : 1
        const aDate = lastAttendedMap.get(a.id) ?? ''
        const bDate = lastAttendedMap.get(b.id) ?? ''
        if (aDate !== bDate) return bDate.localeCompare(aDate)
        return (a.name_kana ?? a.name).localeCompare(b.name_kana ?? b.name, 'ja')
      })
    }
    return list
  }, [students, search, filterStatus, lastAttendedMap, lastKarteMap, sortKey, sortDir])

  const activeCount = students.filter(s => s.is_active).length
  const inactiveCount = students.filter(s => !s.is_active).length

  return (
    <div>
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

      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: '在籍中', count: activeCount, icon: UserCheck, color: 'bg-green-50 text-green-600', filter: 'active' },
          { label: '全生徒', count: students.length, icon: Users, color: 'bg-indigo-50 text-indigo-600', filter: 'all' },
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

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 size={24} className="animate-spin mr-2" /> 読み込み中...
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <SortTh label="名前" active={sortKey === 'name'} dir={sortDir} onClick={() => toggleSort('name')} />
                <SortTh label="参加者ID" active={sortKey === 'legacy_id'} dir={sortDir} onClick={() => toggleSort('legacy_id')} className="hidden md:table-cell" />
                <SortTh label="電話番号" active={sortKey === 'phone'} dir={sortDir} onClick={() => toggleSort('phone')} className="hidden md:table-cell" />
                <SortTh label="体験レッスン日" active={sortKey === 'joined_at'} dir={sortDir} onClick={() => toggleSort('joined_at')} className="hidden lg:table-cell" />
                <SortTh label="最終参加日" active={sortKey === 'lastAttended'} dir={sortDir} onClick={() => toggleSort('lastAttended')} />
                <SortTh label="最終やり取り" active={sortKey === 'lastKarte'} dir={sortDir} onClick={() => toggleSort('lastKarte')} className="hidden lg:table-cell" />
                <SortTh label="状態" active={sortKey === 'status'} dir={sortDir} onClick={() => toggleSort('status')} />
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-400">
                    <Users size={32} className="mx-auto mb-2 opacity-30" />
                    {search ? '検索条件に一致する生徒が見つかりません' : '生徒が登録されていません'}
                  </td>
                </tr>
              )}
              {filtered.map(s => (
                <tr key={s.id} className={`hover:bg-gray-50 transition-colors ${!s.is_active ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {signedAvatarMap.get(s.id) ? (
                        <img src={signedAvatarMap.get(s.id)} alt={s.name} className="w-12 h-12 rounded object-contain bg-gray-50 flex-shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded bg-indigo-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-indigo-600 text-sm font-bold">{s.name.charAt(0)}</span>
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <Link href={`/students/${s.id}`} className="font-medium text-indigo-600 hover:underline">
                            {s.name}
                          </Link>
                          {s.subsidy_program && (
                            <span title={s.subsidy_program} className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">
                              助成
                            </span>
                          )}
                          {s.contact_method && (
                            <span title={s.contact_detail ?? undefined} className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-sky-100 text-sky-700">
                              {s.contact_method}{s.contact_detail ? `: ${s.contact_detail}` : ''}
                            </span>
                          )}
                          {s.contact_response_level != null && (
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${RESPONSE_LEVEL_STYLE[s.contact_response_level]}`}>
                              {RESPONSE_LEVEL_LABEL[s.contact_response_level]}
                            </span>
                          )}
                        </div>
                        {s.name_kana && <div className="text-xs text-gray-400 mt-0.5">{s.name_kana}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {s.legacy_id != null
                      ? <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-mono">#{s.legacy_id}</span>
                      : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell text-sm">{s.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs hidden lg:table-cell">
                    {s.joined_at ? new Date(s.joined_at).toLocaleDateString('ja-JP') : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{lastAttendedMap.get(s.id) ? new Date(lastAttendedMap.get(s.id)!).toLocaleDateString('ja-JP') : '—'}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs hidden lg:table-cell">{lastKarteMap.get(s.id) ? new Date(lastKarteMap.get(s.id)!).toLocaleDateString('ja-JP') : '—'}</td>
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

        {!loading && filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-500">
            {filtered.length} 名を表示
            {search && <span className="ml-1">（「{search}」で絞り込み）</span>}
          </div>
        )}
      </div>

      {/* 画像クロップモーダル（任意：必要な部分だけ切り取りたい場合のみ使用） */}
      {cropSrc && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col gap-4 p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">画像の範囲を調整</h3>
              <button onClick={() => setCropSrc(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <p className="text-xs text-gray-400 -mt-2">初期状態は画像全体が選択されています。狭めたい場合のみ枠をドラッグしてください。</p>
            <div className="flex justify-center items-center" style={{ height: '55vh' }}>
              <ReactCrop crop={crop} onChange={c => setCrop(c)} keepSelection>
                <img ref={imgRef} src={cropSrc} alt="crop" onLoad={onCropImageLoad} style={{ maxHeight: '55vh', maxWidth: '100%', width: 'auto', height: 'auto' }} />
              </ReactCrop>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setCropSrc(null)} className="px-4 py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50">キャンセル</button>
              <button onClick={confirmCrop} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 flex items-center gap-1.5">
                <Check size={14} />この範囲で確定
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <h2 className="text-lg font-bold text-gray-800">
                {editing ? '生徒情報を編集' : '新規生徒を追加'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
              {/* アバター */}
              <div className="flex items-center gap-4">
                <div className="relative">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="avatar" className="w-28 h-36 rounded-lg object-contain bg-gray-50 border-2 border-gray-200" />
                  ) : (
                    <div className="w-28 h-36 rounded-lg bg-indigo-100 flex items-center justify-center border-2 border-dashed border-indigo-300">
                      <Camera size={32} className="text-indigo-400" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 bg-indigo-600 text-white rounded-full p-1.5 shadow-sm hover:bg-indigo-700"
                  >
                    <Camera size={14} />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                </div>
                <div className="text-xs text-gray-500">
                  <p className="font-medium text-gray-700">プロフィール画像</p>
                  <p>JPG・PNG・GIF対応・画像はそのまま取り込まれます</p>
                  {avatarFile && <p className="text-indigo-600 mt-0.5">{avatarFile.name}</p>}
                  {originalDataUrl && (
                    <button type="button" onClick={openCropTool} className="mt-1 text-indigo-500 hover:text-indigo-700 underline">
                      必要な部分だけ切り取る
                    </button>
                  )}
                </div>
              </div>

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
                <Field label="体験レッスン日">
                  <input
                    type="date"
                    value={form.joined_at}
                    onChange={e => setForm(f => ({ ...f, joined_at: e.target.value }))}
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
                  <Field label="自治体の習い事助成制度（対象の場合のみ入力）">
                    <input
                      type="text"
                      value={form.subsidy_program}
                      onChange={e => setForm(f => ({ ...f, subsidy_program: e.target.value }))}
                      placeholder="例: 吹田市子供の習い事費用助成事業"
                      className={inputCls}
                    />
                  </Field>
                </div>
                <Field label="連絡手段">
                  <select
                    value={form.contact_method}
                    onChange={e => setForm(f => ({ ...f, contact_method: e.target.value }))}
                    className={inputCls}
                  >
                    <option value="">未設定</option>
                    <option value="メール">メール</option>
                    <option value="LINE">LINE</option>
                    <option value="Instagram">Instagram</option>
                    <option value="Messenger">Messenger</option>
                    <option value="電話">電話</option>
                    <option value="その他">その他</option>
                  </select>
                </Field>
                <Field label="連絡先の詳細（LINE IDなど）">
                  <input
                    type="text"
                    value={form.contact_detail}
                    onChange={e => setForm(f => ({ ...f, contact_detail: e.target.value }))}
                    placeholder="例: LINE ID @xxxxx"
                    className={inputCls}
                  />
                </Field>
                <Field label="反応レベル">
                  <select
                    value={form.contact_response_level}
                    onChange={e => setForm(f => ({ ...f, contact_response_level: e.target.value }))}
                    className={inputCls}
                  >
                    <option value="">未設定</option>
                    <option value="0">0: 連絡先不明</option>
                    <option value="1">1: 無反応</option>
                    <option value="2">2: やや反応</option>
                    <option value="3">3: 反応あり</option>
                  </select>
                </Field>

                {/* 郵便番号 */}
                <div className="col-span-2">
                  <Field label="郵便番号">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={form.postal_code}
                        onChange={e => setForm(f => ({ ...f, postal_code: e.target.value }))}
                        onBlur={e => lookupZip(e.target.value)}
                        placeholder="000-0000"
                        maxLength={8}
                        className={`flex-1 ${inputCls}`}
                      />
                      <button
                        type="button"
                        onClick={() => lookupZip(form.postal_code)}
                        disabled={zipLoading}
                        className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-xs font-medium disabled:opacity-50 whitespace-nowrap flex-shrink-0"
                      >
                        {zipLoading ? <Loader2 size={14} className="animate-spin" /> : '住所検索'}
                      </button>
                    </div>
                  </Field>
                </div>

                <div className="col-span-2">
                  <Field label="住所１（都道府県・市区町村）">
                    <input
                      value={form.address1}
                      onChange={e => setForm(f => ({ ...f, address1: e.target.value }))}
                      placeholder="例: 大阪府吹田市千里山西"
                      className={inputCls}
                    />
                    <p className="text-xs text-gray-400 mt-0.5">郵便番号検索で自動入力されます</p>
                  </Field>
                </div>
                <div className="col-span-2">
                  <Field label="住所２（丁目・番地）">
                    <input
                      value={form.address2}
                      onChange={e => setForm(f => ({ ...f, address2: e.target.value }))}
                      placeholder="例: 2丁目3番4号"
                      className={inputCls}
                    />
                    <p className="text-xs text-gray-400 mt-0.5">丁目・番地・号を入力</p>
                  </Field>
                </div>
                <div className="col-span-2">
                  <Field label="住所３（建物名・部屋番号）">
                    <input
                      value={form.address3}
                      onChange={e => setForm(f => ({ ...f, address3: e.target.value }))}
                      placeholder="例: ○○マンション 101号室"
                      className={inputCls}
                    />
                    <p className="text-xs text-gray-400 mt-0.5">マンション名・部屋番号など（任意）</p>
                  </Field>
                </div>
                {(form.address1 || form.address2) && (
                  <div className="col-span-2">
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([form.address1, form.address2, form.address3].filter(Boolean).join(' '))}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 underline"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                      Google マップで確認
                    </a>
                  </div>
                )}
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
