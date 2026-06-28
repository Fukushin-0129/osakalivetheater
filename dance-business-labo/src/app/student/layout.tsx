'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import StudentHeader from '@/components/layout/StudentHeader'
import StudentSidebar from '@/components/layout/StudentSidebar'

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isStudent, setIsStudent] = useState(false)

  useEffect(() => {
    const checkStudentStatus = async () => {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          router.push('/login')
          return
        }

        // 生徒として登録されているか確認
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

        const studentRes = await fetch(
          `${supabaseUrl}/rest/v1/students?email=eq.${encodeURIComponent(user.email || '')}&select=id`,
          {
            headers: {
              apikey: anonKey!,
              Authorization: `Bearer ${anonKey}`,
            },
          }
        )

        const students = await studentRes.json()

        if (Array.isArray(students) && students.length > 0) {
          setIsStudent(true)
        } else {
          // 生徒ではない場合はダッシュボードへ
          router.push('/')
        }
      } catch (error) {
        console.error('Error checking student status:', error)
        router.push('/login')
      } finally {
        setIsLoading(false)
      }
    }

    checkStudentStatus()
  }, [router])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🕺</div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (!isStudent) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <StudentHeader />
      <div className="flex pt-16">
        <StudentSidebar />
        <main className="flex-1 ml-64 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
