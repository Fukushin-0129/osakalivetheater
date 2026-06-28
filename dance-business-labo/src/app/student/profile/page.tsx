'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Mail, Phone, MapPin, Calendar, Save } from 'lucide-react'

interface StudentProfile {
  id: string
  name: string
  name_kana: string
  email: string
  phone: string
  birthdate: string
  address: string
  joined_at: string
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState<Partial<StudentProfile>>({})

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (user) {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
          const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

          const res = await fetch(
            `${supabaseUrl}/rest/v1/students?email=eq.${encodeURIComponent(user.email || '')}&select=*`,
            {
              headers: {
                apikey: anonKey!,
                Authorization: `Bearer ${anonKey}`,
              },
            }
          )

          const students = await res.json()
          if (Array.isArray(students) && students.length > 0) {
            const studentData = students[0]
            setProfile(studentData)
            setFormData(studentData)
          }
        }
      } catch (error) {
        console.error('Error fetching profile:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSave = async () => {
    // TODO: API を通じてプロフィールを更新
    console.log('Saving profile:', formData)
    setIsEditing(false)
  }

  if (loading) {
    return <div className="text-center py-12">読み込み中...</div>
  }

  if (!profile) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <p className="text-gray-600">プロフィール情報を読み込めませんでした</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">👤 プロフィール</h1>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            isEditing
              ? 'bg-gray-200 text-gray-900 hover:bg-gray-300'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
        >
          {isEditing ? 'キャンセル' : '編集する'}
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="space-y-6">
          {/* 基本情報 */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">基本情報</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  氏名
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    name="name"
                    value={formData.name || ''}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                ) : (
                  <p className="text-gray-900">{profile.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  氏名（カナ）
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    name="name_kana"
                    value={formData.name_kana || ''}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                ) : (
                  <p className="text-gray-900">{profile.name_kana || '—'}</p>
                )}
              </div>
            </div>
          </div>

          {/* 連絡先 */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">連絡先</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                  <Mail size={16} /> メールアドレス
                </label>
                <p className="text-gray-900">{profile.email}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                  <Phone size={16} /> 電話番号
                </label>
                {isEditing ? (
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone || ''}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                ) : (
                  <p className="text-gray-900">{profile.phone || '—'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                  <MapPin size={16} /> 住所
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    name="address"
                    value={formData.address || ''}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                ) : (
                  <p className="text-gray-900">{profile.address || '—'}</p>
                )}
              </div>
            </div>
          </div>

          {/* その他の情報 */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">その他の情報</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                  <Calendar size={16} /> 生年月日
                </label>
                {isEditing ? (
                  <input
                    type="date"
                    name="birthdate"
                    value={formData.birthdate || ''}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                ) : (
                  <p className="text-gray-900">
                    {profile.birthdate
                      ? new Date(profile.birthdate).toLocaleDateString('ja-JP')
                      : '—'}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                  <Calendar size={16} /> 入会日
                </label>
                <p className="text-gray-900">
                  {new Date(profile.joined_at).toLocaleDateString('ja-JP')}
                </p>
              </div>
            </div>
          </div>

          {/* 保存ボタン */}
          {isEditing && (
            <div className="pt-4 border-t border-gray-200">
              <button
                onClick={handleSave}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition"
              >
                <Save size={18} /> 保存する
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
