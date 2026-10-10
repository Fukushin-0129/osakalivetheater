'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Student, StagePerformance } from '@/types/database'
import { Plus, Pencil, Trash2, X, Loader2, MapPin, Users, Video, Image as ImageIcon, Theater } from 'lucide-react'

type ParticipantRow = { student_id: string; role: string }
type VideoRow = { url: string; label: string }
type PerformanceWithCounts = StagePerformance & {
  participant_count: number
  participant_names: string[]
}

const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
const MAX_VIDEOS = 5

export default function StagesPage() {
  const [performances, setPerformances] = useState<PerformanceWithCounts[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<StagePerformance | null>(null)
  const [studentSearch, setStudentSearch] = useState('')

  const [form, setForm] = useState({ title: '', performed_at: '', venue: '', notes: '' })
  const [participants, setParticipants] = useState<ParticipantRow[]>([])
  const [videos, setVideos] = useState<VideoRow[]>([])
  const [flyerFile, setFlyerFile] = useState<File | null>(null)
  const [flyerPreview, setFlyerPreview] = useState<string | null>(null)
  const [existingFlyerUrl, setExistingFlyerUrl] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const supabase = createClient()

  async function load() {
    setLoading(true)
    const [{ data: perfs }, { data: participantRows }, { data: stu }] = await Promise.all([
      supabase.from('stage_performances').select('*').order('performed_at', { ascending: false }),
      supabase.from('stage_performance_participants').select('performance_id, students(name)'),
      supabase.from('students').select('*').eq('is_active', true).order('name'),
    ])
    const countMap = new Map<string, string[]>()
    for (const row of participantRows ?? []) {
      const name = (row.students as unknown as { name: string } | null)?.name
      if (!name) continue
      const list = countMap.get(row.performance_id) ?? []
      list.push(name)
      countMap.set(row.performance_id, list)
    }
    setPerformances((perfs ?? []).map(p => ({
      ...p,
      participant_count: countMap.get(p.id)?.length ?? 0,
      participant_names: countMap.get(p.id) ?? [],
    })))
    setStudents(stu ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openNew() {
    setEditing(null)
    setForm({ title: '', performed_at: '', venue: '', notes: '' })
    setParticipants([])
    setVideos([])
    setFlyerFile(null)
    setFlyerPreview(null)
    setExistingFlyerUrl(null)
    setStudentSearch('')
    setFormError(null)
    setShowModal(true)
  }

  async function openEdit(p: StagePerformance) {
    setEditing(p)
    setForm({
      title: p.title,
      performed_at: p.performed_at,
      venue: p.venue ?? '',
      notes: p.notes ?? '',
    })
    setFlyerFile(null)
    setFlyerPreview(null)
    setStudentSearch('')
    setFormError(null)

    const [{ data: parts }, { data: vids }] = await Promise.all([
      supabase.from('stage_performance_participants').select('student_id, role').eq('performance_id', p.id),
      supabase.from('stage_performance_videos').select('url, label').eq('performance_id', p.id).order('display_order'),
    ])
    setParticipants((parts ?? []).map(r => ({ student_id: r.student_id, role: r.role ?? '' })))
    setVideos((vids ?? []).map(v => ({ url: v.url, label: v.label ?? '' })))

    if (p.flyer_url) {
      setExistingFlyerUrl(p.flyer_url)
      if (!p.flyer_url.startsWith('http')) {
        const { data } = await supabase.storage.from('stage-flyers').createSignedUrl(p.flyer_url, 3600)
        setFlyerPreview(data?.signedUrl ?? null)
      } else {
        setFlyerPreview(p.flyer_url)
      }
    } else {
      setExistingFlyerUrl(null)
    }

    setShowModal(true)
  }

  function toggleParticipant(studentId: string) {
    setParticipants(prev => {
      const exists = prev.find(p => p.student_id === studentId)
      if (exists) return prev.filter(p => p.student_id !== studentId)
      return [...prev, { student_id: studentId, role: '' }]
    })
  }

  function updateParticipantRole(studentId: string, role: string) {
    setParticipants(prev => prev.map(p => p.student_id === studentId ? { ...p, role } : p))
  }

  function addVideo() {
    if (videos.length >= MAX_VIDEOS) return
    setVideos(prev => [...prev, { url: '', label: '' }])
  }

  function updateVideo(i: number, field: 'url' | 'label', value: string) {
    setVideos(prev => prev.map((v, idx) => idx === i ? { ...v, [field]: value } : v))
  }

  function removeVideo(i: number) {
    setVideos(prev => prev.filter((_, idx) => idx !== i))
  }

  function onFlyerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFlyerFile(file)
    setFlyerPreview(URL.createObjectURL(file))
  }

  async function uploadFlyer(file: File, performanceId: string): Promise<string | null> {
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${performanceId}/flyer.${ext}`
    const { error } = await supabase.storage.from('stage-flyers').upload(path, file, { upsert: true })
    if (error) return null
    return path
  }

  async function handleSave() {
    if (!form.title.trim() || !form.performed_at) { setFormError('舞台名と開催日は必須です'); return }
    setSaving(true)
    setFormError(null)

    const payload = {
      title: form.title.trim(),
      performed_at: form.performed_at,
      venue: form.venue.trim() || null,
      notes: form.notes.trim() || null,
      updated_at: new Date().toISOString(),
    }

    let performanceId = editing?.id ?? ''
    if (editing) {
      const { error } = await supabase.from('stage_performances').update(payload).eq('id', editing.id)
      if (error) { setFormError(`保存に失敗しました: ${error.message}`); setSaving(false); return }
    } else {
      const { data, error } = await supabase.from('stage_performances').insert(payload).select('id').single()
      if (error) { setFormError(`追加に失敗しました: ${error.message}`); setSaving(false); return }
      performanceId = data?.id ?? ''
    }

    if (flyerFile && performanceId) {
      const path = await uploadFlyer(flyerFile, performanceId)
      if (path) await supabase.from('stage_performances').update({ flyer_url: path }).eq('id', performanceId)
    }

    // 出演者を入れ替え
    await supabase.from('stage_performance_participants').delete().eq('performance_id', performanceId)
    if (participants.length > 0) {
      await supabase.from('stage_performance_participants').insert(
        participants.map(p => ({ performance_id: performanceId, student_id: p.student_id, role: p.role.trim() || null }))
      )
    }

    // 動画リンクを入れ替え
    await supabase.from('stage_performance_videos').delete().eq('performance_id', performanceId)
    const validVideos = videos.filter(v => v.url.trim())
    if (validVideos.length > 0) {
      await supabase.from('stage_performance_videos').insert(
        validVideos.map((v, i) => ({ performance_id: performanceId, url: v.url.trim(), label: v.label.trim() || null, display_order: i }))
      )
    }

    setSaving(false)
    setShowModal(false)
    load()
  }

  async function handleDelete(p: StagePerformance) {
    if (!confirm(`「${p.title}」を削除しますか？\n出演記録・動画リンクも削除されます。`)) return
    await supabase.from('stage_performances').delete().eq('id', p.id)
    load()
  }

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim()
    if (!q) return students
    return students.filter(s => s.name.includes(q) || (s.name_kana ?? '').includes(q))
  }, [students, studentSearch])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Theater size={22} className="text-indigo-500" /> 舞台管理</h1>
          <p className="text-gray-500 text-sm mt-0.5">全 {performances.length} 件</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-sm transition-colors"
        >
          <Plus size={16} /> 新規作成
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm flex items-center justify-center py-20 text-gray-400">
          <Loader2 size={24} className="animate-spin mr-2" /> 読み込み中...
        </div>
      ) : performances.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-400">
          <Theater size={36} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">舞台（公演）が登録されていません</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {performances.map(p => (
            <div key={p.id} className="bg-white rounded-xl shadow-sm overflow-hidden flex flex-col">
              <div className="aspect-[4/3] bg-gray-100 flex items-center justify-center text-gray-300 relative group">
                {p.flyer_url ? (
                  <FlyerThumb path={p.flyer_url} title={p.title} />
                ) : (
                  <Theater size={28} />
                )}
              </div>
              <div className="p-4 flex-1 flex flex-col">
                <div className="text-xs text-indigo-500 font-medium mb-1">
                  {new Date(p.performed_at + 'T00:00:00').toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
                </div>
                <h2 className="font-semibold text-gray-800 mb-1 truncate" title={p.title}>{p.title}</h2>
                {p.venue && <div className="flex items-center gap-1 text-xs text-gray-500 mb-2"><MapPin size={11} /> {p.venue}</div>}
                <div className="flex items-center gap-1 text-xs text-gray-500 mb-3">
                  <Users size={11} /> {p.participant_count}名
                  {p.participant_names.length > 0 && (
                    <span className="truncate text-gray-400">（{p.participant_names.slice(0, 3).join('、')}{p.participant_names.length > 3 ? ' 他' : ''}）</span>
                  )}
                </div>
                <div className="mt-auto flex items-center gap-2">
                  <button onClick={() => openEdit(p)} className="flex-1 flex items-center justify-center gap-1 text-xs text-indigo-600 border border-indigo-200 hover:bg-indigo-50 rounded-lg py-1.5"><Pencil size={12} /> 編集</button>
                  <button onClick={() => handleDelete(p)} className="text-gray-400 hover:text-red-500 p-1.5 rounded hover:bg-red-50 transition-colors"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <h2 className="text-lg font-bold text-gray-800">{editing ? '舞台を編集' : '新規舞台作成'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 p-1"><X size={20} /></button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2 rounded-lg">{formError}</div>
              )}

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">舞台名 *</label>
                  <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="例: 2026年 発表会" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">開催日 *</label>
                  <input type="date" value={form.performed_at} onChange={e => setForm(f => ({ ...f, performed_at: e.target.value }))} className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">会場</label>
                <input value={form.venue} onChange={e => setForm(f => ({ ...f, venue: e.target.value }))} placeholder="例: 〇〇文化ホール" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">メモ</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={inputCls} placeholder="全体の備考など" />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1"><ImageIcon size={13} /> チラシ・プログラム画像</label>
                <div className="flex items-center gap-3">
                  {flyerPreview ? (
                    <img src={flyerPreview} alt="" className="w-20 h-28 object-cover rounded-lg border border-gray-200" />
                  ) : (
                    <div className="w-20 h-28 rounded-lg border border-dashed border-gray-300 flex items-center justify-center text-gray-300"><ImageIcon size={18} /></div>
                  )}
                  <input type="file" accept="image/*" onChange={onFlyerChange} className="text-xs" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1"><Video size={13} /> 動画リンク（YouTube限定公開・最大{MAX_VIDEOS}本）</label>
                <div className="space-y-2">
                  {videos.map((v, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input value={v.url} onChange={e => updateVideo(i, 'url', e.target.value)} placeholder="https://youtu.be/..." className={`${inputCls} flex-1`} />
                      <input value={v.label} onChange={e => updateVideo(i, 'label', e.target.value)} placeholder="メモ（任意）" className={`${inputCls} w-32`} />
                      <button onClick={() => removeVideo(i)} className="text-gray-400 hover:text-red-500 p-1.5"><X size={14} /></button>
                    </div>
                  ))}
                  {videos.length < MAX_VIDEOS && (
                    <button onClick={addVideo} className="flex items-center gap-1 text-xs text-indigo-600 hover:underline"><Plus size={12} /> 動画リンクを追加</button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1"><Users size={13} /> 出演した生徒（{participants.length}名選択中）</label>
                <input value={studentSearch} onChange={e => setStudentSearch(e.target.value)} placeholder="生徒を検索" className={`${inputCls} mb-2`} />
                <div className="border border-gray-100 rounded-xl max-h-64 overflow-y-auto divide-y divide-gray-50">
                  {filteredStudents.map(s => {
                    const participant = participants.find(p => p.student_id === s.id)
                    const checked = !!participant
                    return (
                      <div key={s.id} className={`flex items-center gap-2 px-3 py-2 ${checked ? 'bg-indigo-50/60' : ''}`}>
                        <input type="checkbox" checked={checked} onChange={() => toggleParticipant(s.id)} className="rounded flex-shrink-0" />
                        <span className="text-sm text-gray-700 w-28 truncate flex-shrink-0">{s.name}</span>
                        {checked && (
                          <input
                            value={participant?.role ?? ''}
                            onChange={e => updateParticipantRole(s.id, e.target.value)}
                            placeholder="演目・役割（任意）"
                            className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                          />
                        )}
                      </div>
                    )
                  })}
                  {filteredStudents.length === 0 && <p className="text-center text-gray-400 text-xs py-4">該当する生徒がいません</p>}
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50">キャンセル</button>
              <button onClick={handleSave} disabled={saving || !form.title.trim() || !form.performed_at} className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white py-2.5 rounded-xl text-sm font-medium">
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? '保存中...' : editing ? '更新する' : '作成する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FlyerThumb({ path, title }: { path: string; title: string }) {
  const [url, setUrl] = useState<string | null>(path.startsWith('http') ? path : null)
  useEffect(() => {
    if (path.startsWith('http')) return
    const supabase = createClient()
    supabase.storage.from('stage-flyers').createSignedUrl(path, 3600).then(({ data }) => {
      if (data?.signedUrl) setUrl(data.signedUrl)
    })
  }, [path])
  if (!url) return <Theater size={28} className="text-gray-300" />
  return <img src={url} alt={title} className="w-full h-full object-cover" />
}
