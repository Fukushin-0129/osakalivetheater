import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { plan_content, plan_goal } = await req.json()

    const supabase = await createClient()

    // Update lesson's plan fields
    const { error } = await supabase
      .from('lessons')
      .update({
        plan_content: plan_content || null,
        plan_goal: plan_goal || null,
        plan_status: plan_content || plan_goal ? 'planned' : 'not_planned',
        plan_generated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) {
      throw new Error(`Failed to update lesson plan: ${error.message}`)
    }

    return NextResponse.json({
      message: 'Lesson plan updated successfully',
      lesson_id: id,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Error updating lesson plan:', message)
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
