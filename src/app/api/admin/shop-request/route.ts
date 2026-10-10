import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/supabase/service'
import { geekAreaFromAddr } from '@/lib/utils/geekArea'

export const runtime = 'nodejs'

/* ============================================================
   샵 등록 요청 처리 — 관리자 전용 (2026-10-10)

   일반 사용자가 등록한 샵은 '등록 요청'(status='pending')으로 들어온다.
   관리자가 [샵 등록 요청] 화면에서 정보를 확인하고
     approve  → 공개(status='active') + 검수 완료 + 등록자에게 경험치 + 알림
     return   → 보완 요청: 공개 전이면 임시(hidden)로 되돌리고 검수 '추가 확인' + 알림
   (migrations/shop_register_request.sql)

   왜 서버인가
     · 남의 샵을 공개하고 남에게 경험치를 주는 일이라 브라우저에 맡기지 않는다.
       /api/activity 는 '세션 사용자 본인'에게만 보상한다.
     · 등록자·상태는 요청값을 믿지 않고 DB 에서 다시 읽는다.
     · 경험치 금액은 record_activity_reward 안에서만 정해진다(shop_register = 15).
       같은 샵으로 여러 번 눌러도 source 기준으로 한 번만 지급된다.
       → 공개는 됐는데 보상만 실패했으면, 다시 눌러 보상만 재시도할 수 있다.
   ============================================================ */

type Action = 'approve' | 'return'

export async function POST(req: NextRequest) {
  // 1) 관리자 확인 — 서버에서
  const userSupabase = await createServerClient()
  const { data: { user } } = await userSupabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
  const { data: profile } = await userSupabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') return NextResponse.json({ error: '권한이 없어요' }, { status: 403 })

  let body: { shopId?: unknown; action?: unknown; note?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 }) }

  const shopId = typeof body.shopId === 'string' && /^[0-9a-f-]{36}$/i.test(body.shopId) ? body.shopId : null
  const action = body.action === 'approve' || body.action === 'return' ? (body.action as Action) : null
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 300) : ''
  if (!shopId || !action) return NextResponse.json({ error: 'shopId 와 action 이 필요해요' }, { status: 400 })

  const svc = serviceClient()

  // 2) 샵을 DB 에서 다시 읽는다
  const { data: shop, error: readErr } = await svc
    .from('shops')
    .select('id, name, slug, status, added_by, region, addr, places ( name )')
    .eq('id', shopId)
    .maybeSingle()
  if (readErr || !shop) return NextResponse.json({ error: '샵을 찾을 수 없어요' }, { status: 404 })
  const s = shop as any
  if (s.status === 'deleted') return NextResponse.json({ error: '삭제된 샵이에요' }, { status: 409 })

  const reviewed = { reviewed_at: new Date().toISOString(), reviewed_by: user.id }

  // ── 보완 요청 ──
  if (action === 'return') {
    // 아직 공개 전(pending)이면 임시(hidden)로 돌려 등록자가 고쳐서 다시 요청하게 한다.
    // 이미 공개된 샵(예전 '선등록 후검수'로 올라온 것)은 공개 상태를 건드리지 않는다.
    const patch: Record<string, unknown> = { review_status: 'needs_attention', ...reviewed }
    if (s.status === 'pending') patch.status = 'hidden'
    const { error } = await svc.from('shops').update(patch).eq('id', shopId)
    if (error) {
      console.error('[shop-request] 보완 요청 실패', error.code, error.message)
      return NextResponse.json({ error: '보완 요청 처리에 실패했어요' }, { status: 500 })
    }
    let notified = false
    if (s.added_by) {
      const { error: nErr } = await svc.from('notifications').insert({
        user_id: s.added_by,
        type: 'shop_review',
        title: '등록한 샵 정보를 보완해 주세요',
        body: `${s.name ?? '샵'}${note ? ` — ${note}` : ' 정보를 조금 더 채워서 다시 등록 요청해 주세요.'}`,
        link: '/profile?tab=shops',
        related_type: 'shop',
        related_id: shopId,
      } as any)
      notified = !nErr
      if (nErr) console.error('[shop-request] 알림 실패', nErr.code, nErr.message)
    }
    return NextResponse.json({ success: true, notified })
  }

  // ── 확인하고 공개 ──
  if (s.status !== 'active') {
    if (!['pending', 'hidden'].includes(s.status)) {
      return NextResponse.json({ error: `지금 상태(${s.status})에서는 공개할 수 없어요` }, { status: 409 })
    }
  }
  const { error: upErr } = await svc
    .from('shops')
    .update({ status: 'active', review_status: 'reviewed', ...reviewed })
    .eq('id', shopId)
  if (upErr) {
    console.error('[shop-request] 공개 실패', upErr.code, upErr.message)
    return NextResponse.json({ error: '공개 처리에 실패했어요' }, { status: 500 })
  }

  // 3) 등록자에게 경험치 — 관리자가 직접 등록한 샵은 대상 아님(애초에 이 목록에 안 온다)
  let rewarded = false
  let rewardError: string | null = null
  if (s.added_by && s.added_by !== user.id) {
    const { data, error } = await svc.rpc('record_activity_reward', {
      p_user: s.added_by,
      p_type: 'shop_register',
      p_source_id: shopId,
      p_snapshot: Object.fromEntries(Object.entries({
        shop_name: s.name ?? '샵',
        shop_slug: s.slug,
        place_name: s.places?.name,
        region: s.region?.trim() || geekAreaFromAddr(s.addr ?? null),
      }).filter(([, v]) => v !== undefined && v !== null && v !== '')),
      p_title: null,
      p_work_id: null,
    })
    if (error) {
      rewardError = error.message
      console.error('[shop-request] 보상 실패', { shopId, code: error.code, message: error.message })
    } else {
      const row = (Array.isArray(data) ? data[0] : data) as { rewarded?: boolean } | null
      rewarded = !!row?.rewarded
    }

    const { error: nErr } = await svc.from('notifications').insert({
      user_id: s.added_by,
      type: 'shop_approved',
      title: '등록한 샵이 공개됐어요',
      body: `${s.name ?? '샵'}이(가) 지도에 올라갔어요.${rewarded ? ' 경험치를 받았어요!' : ''}`,
      link: `/shop/${s.slug}`,
      related_type: 'shop',
      related_id: shopId,
    } as any)
    if (nErr) console.error('[shop-request] 알림 실패', nErr.code, nErr.message)
  }

  return NextResponse.json({
    success: true,
    rewarded,
    // 공개는 됐는데 보상만 실패한 상태를 숨기지 않는다. 다시 누르면 보상만 재시도된다.
    rewardFailed: rewardError !== null,
  })
}
