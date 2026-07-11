import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set')
    return NextResponse.json(
      { error: 'AI機能が設定されていません（ANTHROPIC_API_KEY未設定）。管理者にご確認ください。' },
      { status: 500 }
    )
  }

  try {
    const { messages, lessonContext } = await req.json()
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY?.trim() })

    const systemPrompt = `あなたはタップダンス教室の先生をサポートするAIアシスタントです。

## 今回のレッスン情報
${lessonContext}

## 返答のルール
- 中学生でもわかる言葉で書く（難しい専門用語は使わない）
- 「まず〇〇をする」「次に〇〇」のように、何をすればいいか順番で伝える
- 理由も一言添える（「なぜなら〜だから」）
- 箇条書きを使って短くまとめる
- 長くなりすぎない（5〜8行以内を目安）
- 日本語で答える`

    const stream = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
      stream: true,
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              controller.enqueue(encoder.encode(event.delta.text))
            }
          }
        } catch (streamError) {
          console.error('AI chat stream error:', streamError)
          controller.enqueue(encoder.encode('\n\n（エラーが発生しました。もう一度お試しください）'))
        } finally {
          controller.close()
        }
      },
    })

    return new NextResponse(readable, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Error in lessons/chat:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
