import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const { messages, studentContext } = await req.json()

  const systemPrompt = `あなたはタップダンス教室の先生をサポートするAIアシスタントです。
生徒の成長をどう促すか、具体的でわかりやすいアドバイスをしてください。

## 生徒の情報
${studentContext}

## 返答のルール
- 中学生でもわかる言葉で書く（難しい専門用語は使わない）
- 「まず〇〇をする」「次に〇〇」のように、何をすればいいか順番で伝える
- 理由も一言添える（「なぜなら〜だから」）
- 箇条書きを使って短くまとめる（5〜8行以内）
- 生徒の目標や現状を踏まえた具体的なアドバイスをする
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
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          controller.enqueue(encoder.encode(event.delta.text))
        }
      }
      controller.close()
    },
  })

  return new NextResponse(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
