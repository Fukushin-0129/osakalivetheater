import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { defaultMessageTemplates } from '@/lib/linkedin-templates'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    // Check if templates already exist
    const { data: existingTemplates, error: checkError } = await supabase
      .from('message_templates')
      .select('id')
      .limit(1)

    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError
    }

    if (existingTemplates && existingTemplates.length > 0) {
      return NextResponse.json(
        { message: 'Templates already initialized' },
        { status: 200 }
      )
    }

    // Insert default templates
    const { data, error } = await supabase
      .from('message_templates')
      .insert(
        defaultMessageTemplates.map((template) => ({
          ...template,
          is_active: true,
        }))
      )
      .select()

    if (error) throw error

    return NextResponse.json(
      {
        message: 'Templates initialized successfully',
        templates: data,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error initializing templates:', error)
    return NextResponse.json(
      { error: 'Failed to initialize templates' },
      { status: 500 }
    )
  }
}
