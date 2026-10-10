import { Video, Play } from 'lucide-react'

function getYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/)
  return m ? m[1] : null
}

export default function VideoThumb({ url, label, size = 'w-28' }: { url: string; label?: string | null; size?: string }) {
  const ytId = getYouTubeId(url)

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={`${size} flex-shrink-0 group block`}>
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
    </a>
  )
}
