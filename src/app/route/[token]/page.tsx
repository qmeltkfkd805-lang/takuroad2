import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { getRouteByShareToken } from '@/services/routeService'
import RouteDetailPage from '@/components/route/RouteDetailPage'

interface Props {
  params: Promise<{ token: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params
  const route = await getRouteByShareToken(token)
  if (!route) return { title: '루트를 찾을 수 없어요' }

  return {
    title: `${route.title} - 타쿠로드 루트`,
    description: route.description ?? `${route.route_shops?.length ?? 0}개의 성지를 도는 루트`,
  }
}

export default async function RouteSharePage({ params }: Props) {
  const { token } = await params
  const route = await getRouteByShareToken(token)

  if (!route || !route.is_shared) notFound()

  return <RouteDetailPage route={route} />
}