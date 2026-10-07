/* 지금 사람들이 관심 있어 하는 이벤트 — 이벤트 홈 히어로용
   점수 = 최근 14일 동안 이벤트 상세를 본 사람 수(브라우저 기준, 중복 제외) + 저장 수×3 + 방문 인증 수×2
   ⚠️ 누가 봤는지는 내보내지 않는다 — 이벤트 id와 점수만 돌려준다. 10분마다 한 번 계산(그 사이엔 캐시). */
import { NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase/service'

export const revalidate = 600

const WINDOW_DAYS = 14
const UUID = /^\/event\/([0-9a-f-]{36})(?:\/|$)/i

export async function GET() {
  try {
    const sb = serviceClient()
    const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()
    const [viewsRes, savesRes, visitsRes] = await Promise.all([
      sb.from('visit_logs').select('path, session_id').like('path', '/event/%').gte('created_at', since).limit(50000),
      sb.from('saved_events').select('event_id').limit(50000),
      sb.from('event_visits').select('event_id').limit(50000),
    ])

    const score = new Map<string, number>()
    const add = (id: string | null | undefined, n: number) => { if (id) score.set(id, (score.get(id) ?? 0) + n) }

    // 상세를 본 사람 수 — 같은 브라우저가 여러 번 봐도 1
    const seen = new Set<string>()
    for (const r of (viewsRes.data ?? []) as any[]) {
      const m = UUID.exec(r.path ?? '')
      if (!m) continue
      const key = `${m[1]}|${r.session_id ?? ''}`
      if (seen.has(key)) continue
      seen.add(key)
      add(m[1].toLowerCase(), 1)
    }
    for (const r of (savesRes.data ?? []) as any[]) add(r.event_id, 3)
    for (const r of (visitsRes.data ?? []) as any[]) add(r.event_id, 2)

    const top = [...score.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([id, s]) => ({ id, score: s }))

    return NextResponse.json({ items: top }, { headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' } })
  } catch {
    return NextResponse.json({ items: [] }, { status: 200 })
  }
}
