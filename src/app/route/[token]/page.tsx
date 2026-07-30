import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import RouteDetailGate from '@/components/route/RouteDetailGate'

interface Props {
  params: Promise<{ token: string }>
}

const SELECT = `
  id, title, description, cover_image_url, is_official,
  likes, official_difficulty, target_audience, tips, primary_tag_id,
  total_distance_m, total_duration_min,
  is_shared, user_id, created_at, share_token,
  profiles!routes_user_id_fkey ( nickname ),
  route_shops (
    id, sort_order, distance_from_prev_m, duration_from_prev_min,
    shops ( id, slug, name, addr, lat, lng, region,
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
  const route = await fetchRoute(token)
  if (!route) notFound()
  return <RouteDetailGate route={route} />
}
