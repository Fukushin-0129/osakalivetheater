import { getAuthenticatedPortalStudent } from '@/lib/portal/auth'
import { Theater, MapPin } from 'lucide-react'
import VideoThumb from '@/components/VideoThumb'

export default async function PortalStagesPage() {
  const { student, admin } = await getAuthenticatedPortalStudent()

  if (!student) {
    return <p className="text-center text-gray-500 py-16">生徒情報が見つかりません</p>
  }

  const { data: participantRows } = await admin!
    .from('stage_performance_participants')
    .select('role, stage_performances(id, title, performed_at, venue, flyer_url, notes)')
    .eq('student_id', student.id)

  type Row = { role: string | null; stage_performances: { id: string; title: string; performed_at: string; venue: string | null; flyer_url: string | null; notes: string | null } | null }
  const performances = ((participantRows ?? []) as unknown as Row[])
    .filter(r => r.stage_performances)
    .sort((a, b) => b.stage_performances!.performed_at.localeCompare(a.stage_performances!.performed_at))

  const performanceIds = performances.map(r => r.stage_performances!.id)
  const { data: videoRows } = performanceIds.length
    ? await admin!.from('stage_performance_videos').select('performance_id, url, label').in('performance_id', performanceIds).order('display_order')
    : { data: [] }

  const videoMap = new Map<string, { url: string; label: string | null }[]>()
  for (const v of videoRows ?? []) {
    const list = videoMap.get(v.performance_id) ?? []
    list.push({ url: v.url, label: v.label })
    videoMap.set(v.performance_id, list)
  }

  const flyerUrls = new Map<string, string>()
  for (const r of performances) {
    const p = r.stage_performances!
    if (p.flyer_url) {
      const url = p.flyer_url.startsWith('http')
        ? p.flyer_url
        : (await admin!.storage.from('stage-flyers').createSignedUrl(p.flyer_url, 3600)).data?.signedUrl
      if (url) flyerUrls.set(p.id, url)
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Theater size={20} className="text-indigo-500" /> 舞台出演履歴
        </h1>
        <p className="text-gray-500 text-sm mt-1">{student.name} さんの出演記録</p>
      </div>

      {performances.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-400">
          <Theater size={32} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">まだ出演記録がありません</p>
        </div>
      ) : (
        <div className="space-y-4">
          {performances.map((r, i) => {
            const p = r.stage_performances!
            const flyer = flyerUrls.get(p.id)
            const videos = videoMap.get(p.id) ?? []
            return (
              <div key={i} className="bg-white rounded-xl shadow-sm overflow-hidden sm:flex">
                {flyer && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={flyer} alt={p.title} className="w-full sm:w-32 aspect-[4/5] sm:aspect-auto object-cover flex-shrink-0" />
                )}
                <div className="p-5 flex-1">
                  <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                    {new Date(p.performed_at + 'T00:00:00').toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
                  </span>
                  <h2 className="font-bold text-gray-800 mt-2">{p.title}</h2>
                  {p.venue && <div className="flex items-center gap-1 text-xs text-gray-500 mt-1"><MapPin size={11} /> {p.venue}</div>}
                  {r.role && <p className="text-sm text-gray-600 mt-2">演目・役割: {r.role}</p>}
                  {p.notes && <p className="text-xs text-gray-400 mt-2 whitespace-pre-wrap">{p.notes}</p>}

                  {videos.length > 0 && (
                    <div className="flex gap-3 overflow-x-auto mt-3 pb-1 scrollbar-none">
                      {videos.map((v, vi) => (
                        <VideoThumb key={vi} url={v.url} label={v.label} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
