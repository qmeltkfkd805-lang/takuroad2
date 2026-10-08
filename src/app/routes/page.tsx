import RouteExplorePage from '@/components/route/RouteExplorePage'
import { pageMeta } from '@/lib/seo/pageMeta'

export const metadata = pageMeta({
  title: '루트 둘러보기',
  description: '굿즈샵과 성지를 하루에 도는 덕질 루트를 찾아보고, 나만의 루트도 만들어 보세요.',
  path: '/routes',
})

export default function Page() {
  return <RouteExplorePage />
}
