import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { connection_id, template_id, custom_message, auto_select = true } = body

    if (!connection_id) {
      return NextResponse.json(
        { error: 'connection_id is required' },
        { status: 400 }
      )
    }

    // Fetch connection details
    const { data: connection, error: connectionError } = await supabase
      .from('linkedin_connections')
      .select('*')
      .eq('id', connection_id)
      .single()

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 404 }
      )
    }

    let messageText = custom_message
    let selectedTemplateId = template_id

    // Auto-select template based on connection category if enabled
    if (!messageText && auto_select && !template_id) {
      const { data: template, error: templateError } = await supabase
        .from('message_templates')
        .select('id, body')
        .eq('category', connection.category)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (!templateError && template) {
        messageText = template.body
        selectedTemplateId = template.id
      }
    }

    // If still no message, try to use provided template_id
    if (!messageText && template_id) {
      const { data: template, error: templateError } = await supabase
        .from('message_templates')
        .select('body')
        .eq('id', template_id)
        .single()

      if (templateError || !template) {
        return NextResponse.json(
          { error: 'Template not found' },
          { status: 404 }
        )
      }

      messageText = template.body
    }

    if (!messageText) {
      return NextResponse.json(
        { error: 'Message text is required. No template found for category: ' + connection.category },
        { status: 400 }
      )
    }

    // Create message record
    const { data: message, error: messageError } = await supabase
      .from('linkedin_messages')
      .insert({
        connection_id,
        template_id: selectedTemplateId || null,
        message_text: messageText,
        delivery_status: 'draft',
      })
      .select()

    if (messageError) throw messageError

    // In production, integrate with LinkedIn API to send the actual message
    // For now, mark as sent
    const { data: updatedMessage, error: updateError } = await supabase
      .from('linkedin_messages')
      .update({
        delivery_status: 'sent',
        sent_at: new Date().toISOString(),
      })
      .eq('id', message[0].id)
      .select()

    if (updateError) throw updateError

    return NextResponse.json(updatedMessage[0], { status: 201 })
  } catch (error) {
    console.error('Error sending message:', error)
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    )
  }
}
