import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import RouteDetailGate from '@/components/route/RouteDetailGate'

interface Props {
  params: Promise<{ token: string }>
}

const SELECT = `
  id, title, description, cover_image_url, is_official,
  likes, official_difficulty, target_audience, tips, primary_tag_id, themes,
  total_distance_m, total_duration_min,
  is_shared, user_id, created_at, share_token,
  profiles!routes_user_id_fkey ( nickname ),
  primary_tag:tags!primary_tag_id ( name ),
  route_shops (
    id, sort_order, distance_from_prev_m, duration_from_prev_min, move_tip,
    shops ( id, slug, name, addr, lat, lng, region, hours, status, floor, unit, floor_info,
      shop_images ( image_url, is_cover, sort_order ),
      cats
    )
  )
`

async function fetchRoute(token: string) {
  const supabase = await createClient()
  const { data } = await supabase.from('routes').select(SELECT).eq('share_token', token).maybeSingle()
  return data as any
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params
  const route = await fetchRoute(token)
  if (!route) return { title: '루트를 찾을 수 없어요' }
  return {
    title: `${route.title} - 타쿠로드 루트`,
    description: route.description ?? `${route.route_shops?.length ?? 0}개의 성지를 도는 루트`,
  }
}

export default async function RouteSharePage({ params }: Props) {
  const { token } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const route = await fetchRoute(token)
  if (!route) notFound()

  // 자격검사: 공유(is_shared)·공식(is_official) 루트이거나 본인 것만. (비공개/공유해제 → 완전 차단)
  const isAuthor = !!user && user.id === route.user_id
  if (!route.is_shared && !route.is_official && !isAuthor) notFound()

  // 차단 관계면 작성자를 '서버에서' 제거 → 클라로 개인정보(닉네임)가 아예 안 감.
  if (user && !isAuthor && route.user_id) {
    const { data: blocked } = await supabase.rpc('is_blocked_between', { target: route.user_id })
    if (blocked === true) {
      route.profiles = null
      route.author_blocked = true
    }
  }

  return <RouteDetailGate route={route} />
}
