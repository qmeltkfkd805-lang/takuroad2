import { createClient as createServerClient } from '@/lib/supabase/server'

/** 현재 로그인 사용자(쿠키 세션 기반). 클라이언트가 보낸 userId는 절대 신뢰하지 않는다. */
export async function requireUser() {
  const sb = await createServerClient()
  const { data: { user } } = await sb.auth.getUser()
  return user
}

// 응답 매퍼 — 내부 필드(risk_flags 등)는 노출하지 않는다
export const publicSession = (s: any) => ({ id: s.id, routeId: s.route_id, status: s.status, startedAt: s.started_at })
export const publicVisit = (v: any) => ({ checkpointKey: v.checkpoint_key, shopId: v.shop_id, status: v.status, verifiedAt: v.verified_at })
export const publicCheckpoint = (c: any) => ({ key: c.key, kind: c.kind, label: c.label, lat: c.lat, lng: c.lng, shopIds: c.shopIds })
