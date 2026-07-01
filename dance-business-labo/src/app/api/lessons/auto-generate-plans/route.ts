import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()

    // Calculate target date: 3 days from now
    const now = new Date()
    const targetDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
    const targetStart = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate(),
      0,
      0,
      0
    )
    const targetEnd = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate(),
      23,
      59,
      59
    )

    // Get lessons scheduled 3 days from now without a plan
    const { data: targetLessons, error: fetchError } = await supabase
      .from('lessons')
      .select('*')
      .gte('scheduled_at', targetStart.toISOString())
      .lte('scheduled_at', targetEnd.toISOString())
      .eq('plan_status', 'not_planned')

    if (fetchError) {
      throw new Error(`Failed to fetch target lessons: ${fetchError.message}`)
    }

    if (!targetLessons || targetLessons.length === 0) {
      return NextResponse.json({
        message: 'No lessons to plan for 3 days from now',
        count: 0,
      })
    }

    let generatedCount = 0
    const errors: string[] = []

    // Process each target lesson
    for (const lesson of targetLessons) {
      try {
        // Calculate previous week's same time
        const scheduledDate = new Date(lesson.scheduled_at)
        const previousWeekDate = new Date(
          scheduledDate.getTime() - 7 * 24 * 60 * 60 * 1000
        )

        // Find lesson from previous week at same time (within 30 minutes)
        const { data: previousLessons, error: prevError } = await supabase
          .from('lessons')
          .select('*')
          .gte('scheduled_at', new Date(previousWeekDate.getTime() - 30 * 60 * 1000).toISOString())
          .lte('scheduled_at', new Date(previousWeekDate.getTime() + 30 * 60 * 1000).toISOString())
          .neq('id', lesson.id)

        if (prevError) {
          errors.push(`Error finding previous lesson for ${lesson.id}: ${prevError.message}`)
          continue
        }

        // Use the first matching previous lesson
        const previousLesson = previousLessons?.[0]

        // Update the target lesson with plan info
        const { error: updateError } = await supabase
          .from('lessons')
          .update({
            plan_content: previousLesson?.plan_content || null,
            plan_goal: previousLesson?.plan_goal || null,
            plan_status: 'planned',
            plan_generated_at: new Date().toISOString(),
          })
          .eq('id', lesson.id)

        if (updateError) {
          errors.push(`Error updating lesson ${lesson.id}: ${updateError.message}`)
          continue
        }

        // Create lesson_plan record
        const { error: createError } = await supabase
          .from('lesson_plans')
          .insert({
            lesson_id: lesson.id,
            content: previousLesson?.plan_content || null,
            goal: previousLesson?.plan_goal || null,
            generated_from_lesson_id: previousLesson?.id || null,
            status: 'generated',
            generated_at: new Date().toISOString(),
          })

        if (createError) {
          errors.push(
            `Error creating lesson plan for ${lesson.id}: ${createError.message}`
          )
          continue
        }

        generatedCount++
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        errors.push(`Error processing lesson ${lesson.id}: ${message}`)
      }
    }

    return NextResponse.json({
      message: 'Lesson plans auto-generation completed',
      generated: generatedCount,
      total: targetLessons.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Error in auto-generate-lesson-plans:', message)
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
