import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const { messages, lessonContext } = await req.json()

  const systemPrompt = `あなたはタップダンス教室の先生をサポートするAIアシスタントです。
レッスン計画の相談に乗り、具体的で実践的なアドバイスをしてください。

## 今回のレッスン情報
${lessonContext}

## あなたの役割
- 計画中の項目に対して、教え方のコツや順序のアドバイス
- 追加すると良い項目の提案（カリキュラムの項目名を使って）
- 生徒の習熟度に応じた難易度調整の提案
- レッスン時間の配分アドバイス
- 前回の評価を踏まえた今回の重点項目の提案

簡潔で実用的な返答をしてください。日本語で答えてください。`

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
