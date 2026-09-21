import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/supabase/service'
import { geekAreaFromAddr } from '@/lib/utils/geekArea'

export const runtime = 'nodejs'

/* ============================================================
   활동 기록 + 보상 — 유일한 사용자 진입점

   클라이언트는 { type, sourceId } 두 개만 보낸다.
     · userId   → 세션에서 (요청값을 받지 않는다)
     · amount   → record_activity_reward 안에서만 결정된다
     · related_id / title / once → 전부 RPC 가 정한다
     · snapshot → 이 라우트가 원본 행을 읽어서 만든다 (클라이언트 값 안 씀)

   허용되지 않은 필드가 오면 무시하지 않고 400 으로 거부한다.
   요청이 조용히 다르게 해석되는 상황을 만들지 않기 위해서다.

   ⚠️ 여기 없는 유형
     route_completed  /api/route-session/end 만 (GPS 세션 검증 필요)
     event_submit     /api/admin/approve-submission 만 (대상이 제보자다)
     work_register    검수 정책이 정해질 때까지 보상하지 않는다
     badge            /api/badges/evaluate
   ============================================================ */

const ALLOWED_TYPES = new Set([
  'shop_visit',
  'event_visit',
  'review',
  'photo_upload',
  'shop_register',
  'route_created',
  'fanart',
])

type Snapshot = Record<string, string | number | null>
interface Built { snapshot: Snapshot; workId: string | null; occurredAt?: string | null }

/** 값이 없는 키는 아예 넣지 않는다 (기존 createActivity 가 undefined 를 빼던 것과 같다) */
function clean(o: Record<string, string | number | null | undefined>): Snapshot {
  const out: Snapshot = {}
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== '') out[k] = v
  return out
}

/** date(YYYY-MM-DD) 를 그 날짜의 KST 정오로 고정한다.
    시간대 변환으로 전날·다음 날로 밀리지 않게 하기 위함이다.
    값이 없거나 형식이 다르면 null — 그때는 RPC 가 넣은 now() 를 그대로 둔다. */
function kstNoon(d: unknown): string | null {
  if (typeof d !== 'string') return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d)
  return m ? `${m[1]}-${m[2]}-${m[3]}T12:00:00+09:00` : null
}

export async function POST(req: NextRequest) {
  const userSupabase = await createServerClient()
  const { data: { user } } = await userSupabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 }) }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 })
  }

  const keys = Object.keys(body as Record<string, unknown>)
  const extra = keys.filter(k => k !== 'type' && k !== 'sourceId')
  if (extra.length > 0) {
    return NextResponse.json({ error: `허용되지 않은 필드: ${extra.join(', ')}` }, { status: 400 })
  }

  const { type, sourceId } = body as { type?: unknown; sourceId?: unknown }
  if (typeof type !== 'string' || !ALLOWED_TYPES.has(type)) {
    return NextResponse.json({ error: '허용되지 않은 활동 유형이에요' }, { status: 400 })
  }
  if (typeof sourceId !== 'string' || !/^[0-9a-f-]{36}$/i.test(sourceId)) {
    return NextResponse.json({ error: 'sourceId 가 올바르지 않아요' }, { status: 400 })
  }

  const svc = serviceClient()

  let built: Built
  try {
    built = await buildSnapshot(svc, type, sourceId, user.id)
  } catch (e) {
    console.error('[activity] 스냅샷 실패', type, sourceId, e)
    return NextResponse.json({ error: '활동 정보를 읽지 못했어요' }, { status: 500 })
  }

  const { data, error } = await svc.rpc('record_activity_reward', {
    p_user: user.id,
    p_type: type,
    p_source_id: sourceId,
    p_snapshot: built.snapshot,
    p_title: null,
    p_work_id: built.workId,
  })

  if (error) {
    // 42501 = 원본이 없거나 남의 것 / 22023 = 허용되지 않은 유형
    const status = error.code === '42501' ? 403 : error.code === '22023' ? 400 : 500
    if (status === 500) console.error('[activity] rpc 실패', { type, sourceId, code: error.code, message: error.message })
    return NextResponse.json(
      { error: status === 500 ? '보상 처리에 실패했어요' : error.message },
      { status },
    )
  }

  const row = (Array.isArray(data) ? data[0] : data) as {
    recorded: boolean; rewarded: boolean; gained: number
    from_level: number; to_level: number; total_exp: number
  } | null

  if (!row) return NextResponse.json({ recorded: false, rewarded: false, gained: 0 })

  // 참여 날짜 보존 — RPC 는 occurred_at 에 now() 를 넣는다.
  // 클라이언트 값을 믿지 않고, 서버가 본인 소유 원본 행에서 읽은 날짜로만 교정한다.
  if (row.recorded && built.occurredAt) {
    const { error: upErr } = await svc.from('activity_logs')
      .update({ occurred_at: built.occurredAt })
      .eq('user_id', user.id).eq('type', type).eq('source_id', sourceId)
    if (upErr) console.error('[activity] occurred_at 교정 실패', sourceId, upErr.message)
  }

  return NextResponse.json({
    recorded: row.recorded,
    rewarded: row.rewarded,
    gained: row.gained,
    leveledUp: row.to_level > row.from_level,
    fromLevel: row.from_level,
    toLevel: row.to_level,
    totalExp: row.total_exp,
  })
}


/* ------------------------------------------------------------
   스냅샷 — 원본 행에서 서버가 직접 만든다.
   필드 구성은 기존 activityService 의 record*Activity 와 같게 맞췄다.
   (연대기·활동 기록 문구가 이 값들을 읽는다)

   ⚠️ 소유자 검증은 여기서 하지 않는다. RPC 가 다시 한다.
      여기 조회는 스냅샷 재료를 얻기 위한 것뿐이다.
   ------------------------------------------------------------ */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Svc = any

async function buildSnapshot(svc: Svc, type: string, sourceId: string, userId: string): Promise<Built> {
  if (type === 'shop_visit') {
    const { data: ci } = await svc.from('check_ins').select('shop_id').eq('id', sourceId).eq('user_id', userId).maybeSingle()
    if (!ci) return { snapshot: {}, workId: null }
    const { data: s } = await svc.from('shops')
      .select('name, slug, region, addr, places ( name )').eq('id', ci.shop_id).maybeSingle()
    return {
      snapshot: clean({
        shop_name: s?.name ?? '샵',
        shop_slug: s?.slug,
        place_name: s?.places?.name,
        region: s?.region?.trim() || geekAreaFromAddr(s?.addr ?? null),
      }),
      workId: null,
    }
  }

  if (type === 'event_visit') {
    const { data: ev } = await svc.from('event_visits').select('event_id, visited_on').eq('id', sourceId).eq('user_id', userId).maybeSingle()
    if (!ev) return { snapshot: {}, workId: null }
    const { data: e } = await svc.from('events')
      .select('title, type, tag_id, place_name, place_addr, shops ( name, addr, region, places ( name ) )')
      .eq('id', ev.event_id).maybeSingle()
    const shop = e?.shops ?? null
    const addr: string | null = shop?.addr ?? e?.place_addr ?? null
    let workName: string | null = null
    if (e?.tag_id) {
      const { data: tag } = await svc.from('tags').select('name').eq('id', e.tag_id).maybeSingle()
      workName = tag?.name ?? null
    }
    return {
      snapshot: clean({
        event_name: e?.title ?? '이벤트',
        event_type: e?.type ?? 'popup',
        place_name: shop?.places?.name ?? e?.place_name,
        region: shop?.region?.trim() || geekAreaFromAddr(addr),
        work_name: workName,
      }),
      workId: e?.tag_id ?? null,
      occurredAt: kstNoon(ev.visited_on),
    }
  }

  if (type === 'review') {
    const { data: r } = await svc.from('reviews').select('shop_id').eq('id', sourceId).eq('user_id', userId).maybeSingle()
    if (r) {
      const { data: s } = await svc.from('shops').select('name, slug, region, addr').eq('id', r.shop_id).maybeSingle()
      return {
        snapshot: clean({
          shop_name: s?.name ?? '샵',
          shop_slug: s?.slug,
          review_id: sourceId,
          region: s?.region?.trim() || geekAreaFromAddr(s?.addr ?? null),
        }),
        workId: null,
      }
    }
    // 이벤트 후기
    const { data: er } = await svc.from('event_reviews').select('event_id').eq('id', sourceId).eq('user_id', userId).maybeSingle()
    if (!er) return { snapshot: {}, workId: null }
    const { data: e } = await svc.from('events').select('title, type, tag_id').eq('id', er.event_id).maybeSingle()
    let workName: string | null = null
    if (e?.tag_id) {
      const { data: tag } = await svc.from('tags').select('name').eq('id', e.tag_id).maybeSingle()
      workName = tag?.name ?? null
    }
    return {
      snapshot: clean({
        event_name: e?.title ?? '이벤트',
        event_type: e?.type,
        review_id: sourceId,
        work_name: workName,
      }),
      workId: e?.tag_id ?? null,
    }
  }

  if (type === 'photo_upload') {
    // source 는 리뷰 id 다. 사진 장수는 서버가 센다.
    const { data: r } = await svc.from('reviews').select('shop_id').eq('id', sourceId).eq('user_id', userId).maybeSingle()
    if (!r) return { snapshot: {}, workId: null }
    const { count } = await svc.from('review_images').select('id', { count: 'exact', head: true }).eq('review_id', sourceId)
    const { data: s } = await svc.from('shops').select('name, slug, region, addr').eq('id', r.shop_id).maybeSingle()
    return {
      snapshot: clean({
        shop_name: s?.name,
        shop_slug: s?.slug,
        review_id: sourceId,
        photo_count: count ?? 1,
        region: s?.region?.trim() || geekAreaFromAddr(s?.addr ?? null),
      }),
      workId: null,
    }
  }

  if (type === 'shop_register') {
    const { data: s } = await svc.from('shops')
      .select('name, slug, region, addr, places ( name )').eq('id', sourceId).eq('added_by', userId).maybeSingle()
    if (!s) return { snapshot: {}, workId: null }
    return {
      snapshot: clean({
        shop_name: s.name ?? '샵',
        shop_slug: s.slug,
        place_name: s.places?.name,
        region: s.region?.trim() || geekAreaFromAddr(s.addr ?? null),
      }),
      workId: null,
    }
  }

  if (type === 'route_created') {
    const { data: r } = await svc.from('routes').select('title, share_token').eq('id', sourceId).eq('user_id', userId).maybeSingle()
    if (!r) return { snapshot: {}, workId: null }
    return {
      snapshot: clean({ route_name: r.title ?? '루트', route_token: r.share_token }),
      workId: null,
    }
  }

  // fanart 는 activity_logs 행을 만들지 않는다 (EXP 만). 스냅샷이 필요 없다.
  return { snapshot: {}, workId: null }
}
