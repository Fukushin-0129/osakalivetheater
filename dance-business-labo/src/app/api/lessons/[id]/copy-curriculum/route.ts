import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: lessonId } = await params
    const supabase = await createClient()

    // Get current lesson
    const { data: currentLesson, error: fetchError } = await supabase
      .from('lessons')
      .select('*')
      .eq('id', lessonId)
      .single()

    if (fetchError || !currentLesson) {
      throw new Error('Lesson not found')
    }

    // Calculate previous week's date
    const scheduledDate = new Date(currentLesson.scheduled_at)
    const previousWeekDate = new Date(
      scheduledDate.getTime() - 7 * 24 * 60 * 60 * 1000
    )

    // Find lesson from previous week (same time, within 30 minutes)
    const { data: previousLessons, error: prevError } = await supabase
      .from('lessons')
      .select('*')
      .gte('scheduled_at', new Date(previousWeekDate.getTime() - 30 * 60 * 1000).toISOString())
      .lte('scheduled_at', new Date(previousWeekDate.getTime() + 30 * 60 * 1000).toISOString())
      .neq('id', lessonId)
      .order('scheduled_at', { ascending: false })
      .limit(1)

    if (prevError) {
      throw new Error(`Failed to find previous week lesson: ${prevError.message}`)
    }

    const previousLesson = previousLessons?.[0]
    if (!previousLesson) {
      return NextResponse.json(
        { error: '前週の同じ時間のレッスンが見つかりません' },
        { status: 404 }
      )
    }

    // Get curriculum items from previous lesson
    const { data: prevPlanItems, error: planError } = await supabase
      .from('lesson_plan_items')
      .select('*')
      .eq('lesson_id', previousLesson.id)

    if (planError) {
      throw new Error(`Failed to fetch previous plan items: ${planError.message}`)
    }

    if (!prevPlanItems || prevPlanItems.length === 0) {
      return NextResponse.json(
        { error: '前週のレッスンにカリキュラムが設定されていません' },
        { status: 400 }
      )
    }

    // Delete existing plan items for current lesson
    const { error: deleteError } = await supabase
      .from('lesson_plan_items')
      .delete()
      .eq('lesson_id', lessonId)

    if (deleteError) {
      throw new Error(`Failed to delete existing plan items: ${deleteError.message}`)
    }

    // Copy plan items from previous lesson
    const newPlanItems = prevPlanItems.map((item, index) => ({
      lesson_id: lessonId,
      curriculum_item_id: item.curriculum_item_id,
      plan_notes: item.plan_notes,
      display_order: index,
    }))

    const { data: insertedItems, error: insertError } = await supabase
      .from('lesson_plan_items')
      .insert(newPlanItems)
      .select()

    if (insertError) {
      throw new Error(`Failed to copy plan items: ${insertError.message}`)
    }

    // Update lesson plan metadata
    const { error: updateError } = await supabase
      .from('lessons')
      .update({
        plan_status: 'planned',
        plan_generated_at: new Date().toISOString(),
      })
      .eq('id', lessonId)

    if (updateError) {
      console.error('Warning: Failed to update lesson plan status:', updateError.message)
    }

    return NextResponse.json({
      message: 'カリキュラムをコピーしました',
      copied_from: previousLesson.title,
      copied_from_date: previousLesson.scheduled_at,
      items_count: insertedItems?.length ?? newPlanItems.length,
      plan_items: insertedItems || newPlanItems,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Error copying curriculum:', message)
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
