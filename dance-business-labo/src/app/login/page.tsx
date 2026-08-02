'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

type Mode = 'login' | 'signup' | 'reset'

const ERROR_MESSAGES: Record<string, string> = {
  'Invalid login credentials': 'メールアドレスまたはパスワードが正しくありません',
  'Email not confirmed': 'メールアドレスの確認が完了していません。メールをご確認ください',
  'User already registered': 'このメールアドレスはすでに登録されています',
  'Password should be at least 6 characters': 'パスワードは6文字以上で入力してください',
  'Unable to validate email address: invalid format': 'メールアドレスの形式が正しくありません',
}

function translateError(msg: string) {
  return ERROR_MESSAGES[msg] ?? msg
}

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  function reset() {
    setError(null)
    setSuccess(null)
    setPassword('')
    setShowPassword(false)
  }

  function switchMode(next: Mode) {
    reset()
    setMode(next)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    const supabase = createClient()

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error

        // 生徒か先生かを判定
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        const studentRes = await fetch(
          `${supabaseUrl}/rest/v1/students?email=eq.${encodeURIComponent(email)}&select=id`,
          {
            headers: {
              apikey: anonKey!,
              Authorization: `Bearer ${anonKey}`,
            },
          }
        )
        const students = await studentRes.json()

        if (Array.isArray(students) && students.length > 0) {
          router.push('/portal')
        } else {
          router.push('/')
        }
        return
      }

      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        })
        if (error) throw error
        setSuccess('確認メールを送信しました。メールのリンクをクリックしてアカウントを有効化してください。')
        setEmail('')
        setPassword('')
        return
      }

      if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
        })
        if (error) throw error
        setSuccess('パスワードリセットのメールを送信しました。メールをご確認ください。')
        setEmail('')
        return
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'エラーが発生しました'
      setError(translateError(msg))
    } finally {
      setLoading(false)
    }
  }

  const titles: Record<Mode, { heading: string; sub: string; btn: string }> = {
    login:  { heading: 'ログイン',           sub: 'アカウント情報を入力してください',   btn: 'ログイン' },
    signup: { heading: 'アカウント登録',      sub: '新しいアカウントを作成します',       btn: '登録する' },
    reset:  { heading: 'パスワードをリセット', sub: '登録済みのメールアドレスを入力してください', btn: 'リセットメールを送信' },
  }

  const { heading, sub, btn } = titles[mode]

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* ロゴ・タイトル */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl shadow-lg mb-4">
            <span className="text-3xl">🕺</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Dance Business Labo</h1>
          <p className="text-gray-500 text-sm mt-1">タップダンス教室管理システム</p>
        </div>

        {/* カード */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-800">{heading}</h2>
            <p className="text-gray-500 text-sm mt-1">{sub}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* メールアドレス */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                メールアドレス
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="example@email.com"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
              />
            </div>

            {/* パスワード（resetモード以外） */}
            {mode !== 'reset' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-gray-700">
                    パスワード
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => switchMode('reset')}
                      className="text-xs text-indigo-600 hover:text-indigo-700 hover:underline"
                    >
                      パスワードを忘れた方
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    placeholder="••••••••"
                    className="w-full px-4 py-2.5 pr-11 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {mode === 'signup' && password.length > 0 && password.length < 6 && (
                  <p className="text-xs text-red-500 mt-1">6文字以上で入力してください</p>
                )}
              </div>
            )}

            {/* エラー */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl flex items-start gap-2">
                <span className="mt-0.5">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {/* 成功メッセージ */}
            {success && (
              <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-xl flex items-start gap-2">
                <span className="mt-0.5">✅</span>
                <span>{success}</span>
              </div>
            )}

            {/* 送信ボタン */}
            <button
              type="submit"
              disabled={loading || (mode === 'signup' && password.length < 6)}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium py-2.5 rounded-xl transition-colors text-sm"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? '処理中...' : btn}
            </button>
          </form>

          {/* モード切替リンク */}
          <div className="mt-6 pt-5 border-t border-gray-100 text-center text-sm text-gray-500">
            {mode === 'login' && (
              <>
                アカウントをお持ちでない方は{' '}
                <button
                  onClick={() => switchMode('signup')}
                  className="text-indigo-600 font-medium hover:underline"
                >
                  新規登録
                </button>
              </>
            )}
            {mode === 'signup' && (
              <>
                すでにアカウントをお持ちの方は{' '}
                <button
                  onClick={() => switchMode('login')}
                  className="text-indigo-600 font-medium hover:underline"
                >
                  ログイン
                </button>
              </>
            )}
            {mode === 'reset' && (
              <button
                onClick={() => switchMode('login')}
                className="text-indigo-600 font-medium hover:underline"
              >
                ← ログインに戻る
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          © 2026 Dance Business Labo
        </p>
      </div>
    </div>
  )
}
