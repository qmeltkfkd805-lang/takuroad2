import { NextResponse } from 'next/server'
import { resolveProfileAccess, isHttp, noStore } from '@/lib/profile/profileAccess'
import { resolveEventCover } from '@/lib/event/eventCover'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* 공개 프로필 > 방문 기록
   GET /api/profile/{userId}/visits?before=ISO

   원본 = 연대기와 같은 activity_logs (샵 방문 · 이벤트 다녀왔어요 · 루트 완주).
   activity_logs 는 RLS 가 본인 전용이라 service-role 로 읽고, 아래 규칙을 모두 통과한 것만 내보낸다.
     - 공개범위 '활동 내역'(activity)        : 모든 방문 기록의 전제
     - 샵 방문   + '방문한 샵'(visited_shops)
     - 루트 완주 + '완주한 루트'(completed_routes)
     - 원본(샵·이벤트·루트)을 보는 사람이 지금 볼 수 있어야 함 — 보는 사람 세션으로 조회해 RLS 에 맡긴다
       (숨긴 이벤트, 비공개 루트, 내려간 샵은 남에게 안 나온다)
   다녀왔어요 사진: 본인은 전부, 남에게는 visibility='public' 으로 고른 사진만 (이벤트를 볼 수 있을 때).
     파일은 비공개 버킷이라 여기서 service-role 로 10분짜리 서명 URL 을 만든다.
   내보내지 않는 것: 나만 보기 사진(남에게), 제목 외 설명 문구, 경험치, 내부 id 외의 원본 필드.
   루트 완주는 snapshot.verified === 'gps' 일 때만 gps=true (GPS 인증이라고 표시해도 되는 것). */

const PAGE = 60
const TYPES = ['shop_visit', 'event_visit', 'route_completed']

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const acc = await resolveProfileAccess({ id })
  if (!acc) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: noStore })
  if (!acc.allow('activity')) return NextResponse.json({ items: [], nextBefore: null, hidden: true }, { headers: noStore })

  const types = TYPES.filter(t =>
    (t !== 'shop_visit' || acc.allow('visited_shops')) &&
    (t !== 'route_completed' || acc.allow('completed_routes')))

  const before = new URL(req.url).searchParams.get('before')
  let q = acc.svc.from('activity_logs')
    .select('id, type, snapshot, related_type, related_id, source_id, occurred_at, created_at, title')
    .eq('user_id', acc.owner.id)
    .in('type', types)
    .order('occurred_at', { ascending: false, nullsFirst: false })
    .limit(PAGE + 1)
  if (before) q = q.lt('occurred_at', before)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: 'load_failed' }, { status: 500, headers: noStore })

  const rows = ((data ?? []) as any[])
  const page = rows.slice(0, PAGE)
  const idsOf = (rt: string) => [...new Set(page.filter(a => a.related_type === rt && a.related_id).map(a => a.related_id as string))]

  // 원본을 "보는 사람" 권한으로 조회 — 안 돌아온 원본의 기록은 빼거나(남) 링크 없이(본인) 둔다
  const [shopRes, eventRes, routeRes] = await Promise.all([
    idsOf('shop').length ? acc.viewer.from('shops').select('id, slug, shop_images ( image_url, is_cover )').in('id', idsOf('shop')) : Promise.resolve({ data: [] }),
    idsOf('event').length ? acc.viewer.from('events').select('id, cover_url, tag_id, deleted_at').in('id', idsOf('event')) : Promise.resolve({ data: [] }),
    idsOf('route').length ? acc.viewer.from('routes').select('id, share_token').in('id', idsOf('route')) : Promise.resolve({ data: [] }),
  ]) as any[]

  const shops = new Map<string, any>((shopRes.data ?? []).map((s: any) => [s.id, s]))
  const events = new Map<string, any>((eventRes.data ?? []).filter((e: any) => acc.isSelf || !e.deleted_at).map((e: any) => [e.id, e]))
  const routes = new Map<string, any>((routeRes.data ?? []).map((r: any) => [r.id, r]))

  const tagIds = [...new Set([...events.values()].map(e => e.tag_id).filter(Boolean))]
  const tagCover = new Map<string, string | null>()
  if (tagIds.length) {
    const { data: tags } = await acc.viewer.from('tags').select('id, cover_url').in('id', tagIds)
    for (const t of (tags ?? []) as any[]) tagCover.set(t.id, t.cover_url ?? null)
  }

  const items: any[] = []
  const routeOf = new Map<string, string>()   // 기록 id → 루트 id (완주 후기 사진 붙이기용)
  for (const a of page) {
    const s = a.snapshot ?? {}
    let href: string | null = null
    let thumb: string | null = null
    let visible = true

    if (a.type === 'shop_visit') {
      const shop = a.related_id ? shops.get(a.related_id) : null
      visible = !!shop
      if (shop) {
        href = shop.slug ? `/shop/${shop.slug}` : null
        const imgs = shop.shop_images ?? []
        thumb = (imgs.find((i: any) => i.is_cover) ?? imgs[0])?.image_url ?? null
      }
    } else if (a.type === 'event_visit') {
      const ev = a.related_id ? events.get(a.related_id) : null
      visible = !!ev
      if (ev) {
        href = `/event/${ev.id}`
        thumb = resolveEventCover({ eventCoverUrl: ev.cover_url, workCoverUrl: ev.tag_id ? tagCover.get(ev.tag_id) : null })
      }
    } else if (a.type === 'route_completed') {
      const rt = a.related_id ? routes.get(a.related_id) : null
      visible = !!rt
      if (rt) routeOf.set(a.id, rt.id)
      if (rt?.share_token) href = `/route/${rt.share_token}`
    }
    if (!visible && !acc.isSelf) continue

    items.push({
      id: a.id,
      type: a.type,
      at: a.occurred_at ?? a.created_at,
      name: s.shop_name ?? s.event_name ?? s.route_name ?? a.title ?? null,
      eventType: a.type === 'event_visit' ? (s.event_type ?? null) : null,
      placeName: s.place_name ?? null,
      region: s.region ?? null,
      workName: s.work_name ?? null,
      gps: a.type === 'route_completed' && s.verified === 'gps',
      href,
      thumb: isHttp(thumb) ? thumb : null,
    })
  }

  // 이벤트 기록에 남긴 사진 — 위에서 걸러진(보여줄) 이벤트 기록에만 붙인다
  const evIds = [...new Set(items.filter(i => i.type === 'event_visit' && i.href).map(i => i.href.slice('/event/'.length)))]
  if (evIds.length) {
    const { data: ph, error: phErr } = await acc.svc.from('event_visit_photos')
      .select('event_id, object_path, visibility, created_at')
      .eq('user_id', acc.owner.id).in('event_id', evIds).order('created_at', { ascending: true })
    // 공개 칸이 아직 없으면(SQL 적용 전) 남에게는 아무 사진도 안 준다
    const rows = phErr ? [] : ((ph ?? []) as any[]).filter(r => acc.isSelf || r.visibility === 'public')
    if (rows.length) {
      const { data: signed } = await acc.svc.storage.from('visit-photos').createSignedUrls(rows.map(r => r.object_path), 600)
      const byPath = new Map<string, string>()
      for (const x of signed ?? []) if (x.path && x.signedUrl) byPath.set(x.path, x.signedUrl)
      const byEvent = new Map<string, { url: string; private: boolean }[]>()
      for (const r of rows) {
        const url = byPath.get(r.object_path)
        if (!url) continue
        if (!byEvent.has(r.event_id)) byEvent.set(r.event_id, [])
        byEvent.get(r.event_id)!.push({ url, private: acc.isSelf && r.visibility !== 'public' })
      }
      for (const it of items) {
        if (it.type !== 'event_visit' || !it.href) continue
        const list = byEvent.get(it.href.slice('/event/'.length))
        if (list?.length) it.photos = list
      }
    }
  }

  // 루트 완주 기록에 그 루트의 완주 후기 사진 (공개 버킷, 루트를 볼 수 있을 때만 — 위에서 걸러짐)
  const rIds = [...new Set(items.filter(i => routeOf.has(i.id)).map(i => routeOf.get(i.id)!))]
  if (rIds.length) {
    const { data: rv, error: rvErr } = await acc.svc.from('route_reviews')
      .select('route_id, route_review_photos ( object_path, sort, created_at )')
      .eq('user_id', acc.owner.id).in('route_id', rIds).order('created_at', { ascending: true })
    if (!rvErr) {
      const byRoute = new Map<string, { url: string; private: boolean }[]>()
      for (const r of (rv ?? []) as any[]) {
        const list = [...(r.route_review_photos ?? [])]
          .sort((x: any, y: any) => (x.sort - y.sort) || String(x.created_at).localeCompare(String(y.created_at)))
          .map((p: any) => ({ url: acc.svc.storage.from('route-photos').getPublicUrl(p.object_path).data.publicUrl, private: false }))
        if (list.length) byRoute.set(r.route_id, [...(byRoute.get(r.route_id) ?? []), ...list])   // 완주 후기 여러 개 → 사진 이어 붙임
      }
      for (const it of items) { const rid = routeOf.get(it.id); const list = rid ? byRoute.get(rid) : null; if (list) it.photos = list }
    }
  }

  // 몇 번째 방문인지(샵) · 총 몇 번 완주했는지(루트) — 하루 1번씩 센다 (SQL: migrations/visit_counts.sql)
  const shopIdsShown = [...new Set(page.filter(a => a.type === 'shop_visit' && a.related_id).map(a => a.related_id as string))]
  if (shopIdsShown.length) {
    const { data: cis } = await acc.svc.from('check_ins')
      .select('id, shop_id, check_in_date, created_at').eq('user_id', acc.owner.id).in('shop_id', shopIdsShown)
      .order('check_in_date', { ascending: true }).order('created_at', { ascending: true })
    const ordinal = new Map<string, number>()   // check_in id → n번째
    const seenPerShop = new Map<string, number>()
    for (const c of (cis ?? []) as any[]) {
      const n = (seenPerShop.get(c.shop_id) ?? 0) + 1
      seenPerShop.set(c.shop_id, n); ordinal.set(c.id, n)
    }
    const srcOf = new Map(page.map(a => [a.id, a.source_id]))
    for (const it of items) if (it.type === 'shop_visit') { const n = ordinal.get(srcOf.get(it.id)); if (n) it.visitNo = n }
  }
  const routeIdsShown = [...new Set(items.filter(i => routeOf.has(i.id)).map(i => routeOf.get(i.id)!))]
  if (routeIdsShown.length) {
    const { data: runs, error: runErr } = await acc.svc.from('route_completion_runs')
      .select('route_id').eq('user_id', acc.owner.id).in('route_id', routeIdsShown)
    if (!runErr) {
      const cnt = new Map<string, number>()
      for (const r of (runs ?? []) as any[]) cnt.set(r.route_id, (cnt.get(r.route_id) ?? 0) + 1)
      for (const it of items) { const rid = routeOf.get(it.id); const n = rid ? cnt.get(rid) : 0; if (n) it.runCount = n }
    }
  }

  const last = page[page.length - 1]
  return NextResponse.json(
    { items, nextBefore: rows.length > PAGE && last ? (last.occurred_at ?? null) : null, hidden: false },
    { headers: noStore },
  )
}
