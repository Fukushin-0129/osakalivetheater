import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// ダッシュボード用APIルートの入口で呼ぶ。RLSは権限不足のとき例外ではなく
// 空の結果を返すため、これを経由せずにRLSだけに任せると「データが無い」と
// 誤認するバグを繰り返しやすい（実際にチケット消化で一度発生した）。
// ここで先にスタッフかどうかを確認し、そうでなければ明確なエラーで止める。
export async function requireStaff(
  supabase: SupabaseClient
): Promise<NextResponse | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  return null
}
