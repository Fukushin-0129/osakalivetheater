import { createClient } from '@/lib/supabase/server'
import { Users, Calendar, TrendingUp, ClipboardCheck } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()

  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const firstOfYear = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0]

  const [
    { count: studentCount },
    { count: lessonCount },
    { count: attendanceCount },
    { data: incomeData },
    { data: expenseData },
    { data: upcomingLessons },
  ] = await Promise.all([
    supabase.from('students').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('lessons').select('*', { count: 'exact', head: true }).gte('scheduled_at', firstOfMonth),
    supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('status', 'present').gte('created_at', firstOfMonth),
    supabase.from('transactions').select('amount').eq('type', 'income').gte('transaction_date', firstOfYear),
    supabase.from('transactions').select('amount').eq('type', 'expense').gte('transaction_date', firstOfYear),
    supabase.from('lessons').select('id, title, scheduled_at, location').gte('scheduled_at', new Date().toISOString()).order('scheduled_at').limit(5),
  ])

  const totalIncome = (incomeData ?? []).reduce((sum, t) => sum + t.amount, 0)
  const totalExpense = (expenseData ?? []).reduce((sum, t) => sum + t.amount, 0)

  const stats = [
    { label: '在籍生徒数', value: `${studentCount ?? 0}名`, icon: Users, color: 'bg-blue-500' },
    { label: '今月のレッスン', value: `${lessonCount ?? 0}回`, icon: Calendar, color: 'bg-green-500' },
    { label: '今月の出席', value: `${attendanceCount ?? 0}件`, icon: ClipboardCheck, color: 'bg-purple-500' },
    { label: '今年の損益', value: `¥${(totalIncome - totalExpense).toLocaleString()}`, icon: TrendingUp, color: 'bg-orange-500' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">ダッシュボード</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-4">
            <div className={`${color} p-3 rounded-lg`}>
              <Icon className="text-white" size={20} />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-800">{value}</div>
              <div className="text-xs text-gray-500">{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="text-base font-semibold text-gray-700 mb-4">直近のレッスン</h2>
        {!upcomingLessons || upcomingLessons.length === 0 ? (
          <p className="text-gray-400 text-sm">予定されているレッスンはありません</p>
        ) : (
          <ul className="space-y-3">
            {upcomingLessons.map((lesson) => (
              <li key={lesson.id} className="flex items-center gap-3 text-sm">
                <div className="w-2 h-2 rounded-full bg-indigo-400 flex-shrink-0" />
                <div>
                  <span className="font-medium text-gray-800">{lesson.title}</span>
                  <span className="text-gray-400 ml-2">
                    {new Date(lesson.scheduled_at).toLocaleString('ja-JP', {
                      month: 'numeric',
                      day: 'numeric',
                      weekday: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {lesson.location && (
                    <span className="text-gray-400 ml-2">📍{lesson.location}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
