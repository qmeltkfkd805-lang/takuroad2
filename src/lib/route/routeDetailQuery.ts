import type { SupabaseClient } from '@supabase/supabase-js'
import { withStopKeys } from '@/lib/route/stopKey'

/* 루트 상세(/route/[token]) 조회 — 서버와 브라우저가 같은 모양으로 읽도록 한 곳에 둔다 (2026-10-24)
   - 서버(app/route/[token]/page.tsx): 비로그인 클라이언트로 공개·공식 루트만 읽어 5분 캐시
   - 브라우저(RouteDetailGate): 서버가 못 읽은 비공개 루트를 작성자 세션으로 다시 읽는다 (routes RLS: 공유·공식·본인만) */
export const ROUTE_DETAIL_SELECT = `
  id, title, description, cover_image_url, is_official,
  likes, official_difficulty, target_audience, tips, primary_tag_id, themes,
  total_distance_m, total_duration_min,
  is_shared, user_id, created_at, share_token,
  profiles!routes_user_id_fkey ( nickname ),
  primary_tag:tags!primary_tag_id ( name ),
  route_shops (
    *,
    shops ( id, slug, name, addr, lat, lng, region, hours, status, floor, unit, floor_info, place_id, places ( name ),
      shop_images ( image_url, is_cover, sort_order ),
      cats
    )
  )
`

export async function fetchRouteDetail(supabase: SupabaseClient, token: string): Promise<any | null> {
  const { data } = await supabase.from('routes').select(ROUTE_DETAIL_SELECT).eq('share_token', token).maybeSingle()
  // 같은 샵이 층마다 나뉜 방문지는 shops.id = "샵id@층", floor_info = 그 층 (lib/route/stopKey)
  return data ? withStopKeys(data as any) : null
}
