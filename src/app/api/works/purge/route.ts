/* 작품을 고친 뒤 화면이 부른다 — 작품 목록·상세 캐시를 바로 비워서 바뀐 사진·정보가 곧장 보이게.
   로그인한 사람만. 비우기만 하고 아무 데이터도 바꾸지 않는다. */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { purgeWorks } from '@/lib/cache/workCache'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
  let slug: string | null = null
  try { const b = await request.json(); if (typeof b?.slug === 'string' && /^[\w\-가-힣%.]{1,200}$/.test(b.slug)) slug = b.slug } catch { /* 본문 없음 */ }
  purgeWorks(slug)
  return NextResponse.json({ ok: true })
}
