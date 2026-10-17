/* 작품을 고친 뒤 화면이 부른다 — 작품 목록·상세 캐시를 바로 비워서 바뀐 사진·정보가 곧장 보이게.
   비우기만 하고 아무 데이터도 바꾸지 않는다.
   2026-10-17: 아무나 계속 불러 캐시를 비우지 못하게, 그 작품을 고칠 수 있는 사람(관리자·등록자)만 허용.
   slug 는 화면이 보낸 값을 믿지 않고 DB에서 읽는다. */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { purgeWorks } from '@/lib/cache/workCache'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })

  let id: string | null = null
  try { const b = await request.json(); if (typeof b?.id === 'string' && /^[0-9a-f-]{36}$/i.test(b.id)) id = b.id } catch { /* 본문 없음 */ }
  if (!id) return NextResponse.json({ error: '작품 id가 필요해요' }, { status: 400 })

  const [{ data: work }, { data: profile }] = await Promise.all([
    supabase.from('tags').select('slug, created_by').eq('id', id).maybeSingle(),
    supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
  ])
  if (!work) return NextResponse.json({ error: '작품을 찾을 수 없어요' }, { status: 404 })
  const isAdmin = profile?.role === 'admin'
  if (!isAdmin && (work as any).created_by !== user.id) return NextResponse.json({ error: '권한이 없어요' }, { status: 403 })

  purgeWorks((work as any).slug ?? null)
  return NextResponse.json({ ok: true })
}
