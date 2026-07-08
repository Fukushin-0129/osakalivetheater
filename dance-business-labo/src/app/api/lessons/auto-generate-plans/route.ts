import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { daysOffset = 0 } = await req.json().catch(() => ({}))

    // Calculate target date (default: today, can offset with daysOffset)
    const now = new Date()
    const targetDate = new Date(now.getTime() + daysOffset * 24 * 60 * 60 * 1000)
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

    console.log(`Searching for lessons between ${targetStart.toISOString()} and ${targetEnd.toISOString()}`)

    // Get lessons on target date without a plan
    const { data: targetLessons, error: fetchError } = await supabase
      .from('lessons')
      .select('*')
      .gte('scheduled_at', targetStart.toISOString())
      .lte('scheduled_at', targetEnd.toISOString())

    if (fetchError) {
      throw new Error(`Failed to fetch target lessons: ${fetchError.message}`)
    }

    console.log(`Found ${targetLessons?.length ?? 0} lessons on target date`)

    if (!targetLessons || targetLessons.length === 0) {
      return NextResponse.json({
        message: `No lessons found for target date (offset: ${daysOffset} days)`,
        count: 0,
        targetDate: targetStart.toISOString().split('T')[0],
      })
    }

    let generatedCount = 0
    const errors: string[] = []
    const results: any[] = []

    // Process each target lesson
    for (const lesson of targetLessons) {
      try {
        const scheduledDate = new Date(lesson.scheduled_at)
        const dayOfWeek = scheduledDate.getDay()

        // Calculate previous week's same time (7 days earlier)
        const previousWeekDate = new Date(
          scheduledDate.getTime() - 7 * 24 * 60 * 60 * 1000
        )

        console.log(`Processing lesson: ${lesson.title} at ${lesson.scheduled_at}`)
        console.log(`Looking for previous week lesson at ${previousWeekDate.toISOString()}`)

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

        const previousLesson = previousLessons?.[0]

        if (!previousLesson) {
          console.log(`No previous week lesson found for ${lesson.title}`)
          results.push({
            lesson_id: lesson.id,
            title: lesson.title,
            status: 'no_previous_lesson',
            message: 'No matching lesson from previous week'
          })
          continue
        }

        console.log(`Found previous lesson: ${previousLesson.title}`)

        // Update the target lesson with plan info
        const { error: updateError } = await supabase
          .from('lessons')
          .update({
            plan_content: previousLesson.plan_content || null,
            plan_goal: previousLesson.plan_goal || null,
            plan_status: 'planned',
            plan_generated_at: new Date().toISOString(),
          })
          .eq('id', lesson.id)

        if (updateError) {
          errors.push(`Error updating lesson ${lesson.id}: ${updateError.message}`)
          continue
        }

        generatedCount++
        results.push({
          lesson_id: lesson.id,
          title: lesson.title,
          status: 'success',
          copied_from: previousLesson.title,
          plan_content: previousLesson.plan_content,
          plan_goal: previousLesson.plan_goal,
        })

        console.log(`✓ Successfully copied plan for ${lesson.title}`)
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        errors.push(`Error processing lesson ${lesson.id}: ${message}`)
      }
    }

    return NextResponse.json({
      message: 'Lesson plan generation completed',
      generated: generatedCount,
      total: targetLessons.length,
      targetDate: targetStart.toISOString().split('T')[0],
      daysOffset,
      results,
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
