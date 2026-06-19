import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const { shopId } = await request.json()
  if (!shopId) return NextResponse.json({ error: 'shopId required' }, { status: 400 })

  const supabase = await createClient()

  // 리뷰 가져오기
  const { data: reviews } = await supabase
    .from('reviews')
    .select('stars, content')
    .eq('shop_id', shopId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(30)

  if (!reviews || reviews.length < 3) {
    return NextResponse.json({ error: '리뷰가 너무 적어요 (최소 3개 필요)' }, { status: 400 })
  }

  const reviewTexts = reviews
    .filter(r => r.content && r.content.trim())
    .map(r => `[${r.stars}점] ${r.content}`)
    .join('\n')

  // Claude API 호출
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `다음은 한 샵에 대한 고객 리뷰들이야. 이 리뷰들을 종합해서 3~4문장으로 자연스러운 한국어 요약을 작성해줘. 장점과 단점을 균형있게 다루고, 과장 없이 객관적으로 써줘. 요약문만 출력하고 다른 설명은 하지 마.\n\n${reviewTexts}`
      }],
    }),
  })

  const data = await response.json()
  const summaryText = data.content?.[0]?.text ?? ''

  if (!summaryText) {
    return NextResponse.json({ error: 'AI 요약 생성에 실패했어요' }, { status: 500 })
  }

  // DB에 저장 (upsert)
  await supabase
    .from('shop_ai_summaries')
    .upsert({
      shop_id: shopId,
      summary_text: summaryText,
      review_count: reviews.length,
      generated_at: new Date().toISOString(),
    } as any, { onConflict: 'shop_id' })

  return NextResponse.json({ summary: summaryText })
}