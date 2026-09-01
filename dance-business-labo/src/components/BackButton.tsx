'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

export default function BackButton({ fallbackHref }: { fallbackHref: string }) {
  const router = useRouter()

  function handleClick() {
    // 直前の画面（一覧のスクロール位置・検索条件など）を保ったまま戻る。
    // 履歴がない場合（直接URLを開いた場合など）は一覧のトップへ。
    if (window.history.length > 1) {
      router.back()
    } else {
      router.push(fallbackHref)
    }
  }

  return (
    <button onClick={handleClick} className="text-gray-400 hover:text-gray-600">
      <ArrowLeft size={20} />
    </button>
  )
}
