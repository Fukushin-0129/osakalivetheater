// 通常の動画・ショート・ライブ・埋め込み・短縮URLなど、様々な形式のYouTube URLからIDを取り出す
export function getYouTubeId(url: string): string | null {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\.|^m\./, '')

    if (host === 'youtu.be') {
      const id = u.pathname.slice(1).split('/')[0]
      return id ? id : null
    }

    if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
      const v = u.searchParams.get('v')
      if (v) return v

      const pathMatch = u.pathname.match(/\/(?:shorts|live|embed)\/([\w-]{11})/)
      if (pathMatch) return pathMatch[1]
    }
  } catch {
    // URLとして解釈できない場合は下の正規表現にフォールバック
  }

  const fallback = url.match(/(?:v=|\/(?:shorts|live|embed)\/|youtu\.be\/)([\w-]{11})/)
  return fallback ? fallback[1] : null
}
