import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import nodemailer from 'nodemailer'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'ログインしてください' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') return NextResponse.json({ error: '管理者のみ実行できます' }, { status: 403 })

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, NOTIFY_EMAIL } = process.env

  const envStatus = {
    SMTP_HOST: SMTP_HOST ?? null,
    SMTP_PORT: SMTP_PORT ?? null,
    SMTP_USER: SMTP_USER ?? null,
    SMTP_PASS: SMTP_PASS ? `設定済み(${SMTP_PASS.length}文字)` : null,
    NOTIFY_EMAIL: NOTIFY_EMAIL ?? null,
  }

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !NOTIFY_EMAIL) {
    return NextResponse.json({ ok: false, step: 'env', envStatus, message: '環境変数が不足しています' })
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  })

  try {
    await transporter.verify()
  } catch (err) {
    return NextResponse.json({
      ok: false,
      step: 'verify',
      envStatus,
      message: 'SMTPサーバーへの接続・認証に失敗しました',
      error: err instanceof Error ? err.message : String(err),
    })
  }

  try {
    const info = await transporter.sendMail({
      from: SMTP_USER,
      to: NOTIFY_EMAIL,
      subject: 'テストメール（Dance Business Labo）',
      text: 'これはテスト送信です。このメールが届いていれば通知メールの設定は正常です。',
    })
    return NextResponse.json({ ok: true, step: 'send', envStatus, messageId: info.messageId })
  } catch (err) {
    return NextResponse.json({
      ok: false,
      step: 'send',
      envStatus,
      message: 'メール送信に失敗しました',
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
