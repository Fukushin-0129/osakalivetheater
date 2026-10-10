'use client'

import { useState } from 'react'
import { Video, Play } from 'lucide-react'

function getYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/)
  return m ? m[1] : null
}

export default function VideoThumb({ url, label, size = 'w-28' }: { url: string; label?: string | null; size?: string }) {
  const [playing, setPlaying] = useState(false)
  const ytId = getYouTubeId(url)

  if (playing && ytId) {
    return (
      <div className={`${size} flex-shrink-0`}>
        <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black">
          <iframe
            src={`https://www.youtube.com/embed/${ytId}?autoplay=1`}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        {label && <p className="text-[11px] text-gray-500 mt-1 truncate">{label}</p>}
      </div>
    )
  }

  return (
    <button onClick={() => setPlaying(true)} className={`${size} flex-shrink-0 group text-left`}>
      <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-gray-100">
        {ytId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300"><Video size={16} /></div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/20 transition-colors">
          <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center shadow-sm">
            <Play size={14} className="text-indigo-600 ml-0.5" fill="currentColor" />
          </div>
        </div>
      </div>
      {label && <p className="text-[11px] text-gray-500 mt-1 truncate">{label}</p>}
    </button>
  )
}
