import { getAuthenticatedPortalStudent } from '@/lib/portal/auth'
import type { CurriculumItem } from '@/types/database'
import { BookOpen, Video as VideoIcon } from 'lucide-react'
import VideoThumb from '@/components/VideoThumb'

type TreeItem = Omit<CurriculumItem, 'children'> & { children: TreeItem[] }

function buildTree(items: CurriculumItem[]): TreeItem[] {
  const map = new Map<string, TreeItem>()
  for (const item of items) map.set(item.id, { ...item, children: [] })
  const roots: TreeItem[] = []
  for (const item of map.values()) {
    if (item.parent_id && map.has(item.parent_id)) {
      map.get(item.parent_id)!.children.push(item)
    } else if (!item.parent_id) {
      roots.push(item)
    }
  }
  return roots
}

// 動画が登録されている項目を持つ枝だけを残す
function hasVideoDeep(item: TreeItem): boolean {
  if (item.video_url) return true
  return item.children.some(hasVideoDeep)
}

function countVideos(item: TreeItem): number {
  return (item.video_url ? 1 : 0) + item.children.reduce((sum, c) => sum + countVideos(c), 0)
}

export default async function PortalVideosPage() {
  const { student, admin } = await getAuthenticatedPortalStudent()

  if (!student) {
    return <p className="text-center text-gray-500 py-16">生徒情報が見つかりません</p>
  }

  const { data: items } = await admin!
    .from('curriculum_items')
    .select('*')
    .order('display_order')
    .order('created_at')

  const tree = buildTree((items ?? []) as CurriculumItem[]).filter(hasVideoDeep)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <BookOpen size={20} className="text-indigo-500" /> 動画ライブラリ
        </h1>
        <p className="text-gray-500 text-sm mt-1">カリキュラムの項目ごとに、お手本動画を見られます</p>
      </div>

      {tree.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-400">
          <VideoIcon size={32} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">まだ動画が登録されていません</p>
        </div>
      ) : (
        <div className="space-y-4">
          {tree.map(root => (
            <RootSection key={root.id} item={root} />
          ))}
        </div>
      )}
    </div>
  )
}

function RootSection({ item }: { item: TreeItem }) {
  const total = countVideos(item)
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <h2 className="font-bold text-gray-800">{item.name}</h2>
        <span className="text-xs text-gray-400">{total}本</span>
      </div>
      <div className="p-5 space-y-5">
        {item.video_url && (
          <VideoThumb url={item.video_url} label={item.name} size="w-32" />
        )}
        {item.children.filter(hasVideoDeep).map(mid => (
          <MidSection key={mid.id} item={mid} />
        ))}
      </div>
    </div>
  )
}

function MidSection({ item }: { item: TreeItem }) {
  const leafVideos = item.children.filter(c => c.video_url)
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-600 mb-2">{item.name}</h3>
      <div className="flex flex-wrap gap-3">
        {item.video_url && <VideoThumb url={item.video_url} label={item.name} size="w-28" />}
        {leafVideos.map(leaf => (
          <VideoThumb key={leaf.id} url={leaf.video_url!} label={leaf.name} size="w-28" />
        ))}
      </div>
    </div>
  )
}
