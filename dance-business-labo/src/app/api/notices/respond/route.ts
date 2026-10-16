import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

function htmlPage(message: string) {
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Dance Business Labo</title></head>
<body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f8fafc;">
  <div style="background: white; padding: 2rem; border-radius: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: center; max-width: 24rem;">
    <p style="font-size: 1rem; color: #374151;">${message}</p>
  </div>
</body></html>`
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token) {
    return new NextResponse(htmlPage('リンクが正しくありません。'), { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }

  const admin = createAdminClient()
  const { data: notice } = await admin.from('lesson_absence_notices').select('id, status').eq('token', token).maybeSingle()

  if (!notice) {
    return new NextResponse(htmlPage('このリンクは無効です。'), { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }

  if (notice.status !== 'acknowledged') {
    await admin.from('lesson_absence_notices').update({ status: 'acknowledged', responded_at: new Date().toISOString() }).eq('id', notice.id)
  }

  return new NextResponse(htmlPage('確認しました。ご連絡ありがとうございます。'), { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}
