import MapPageWrapper from '@/components/map/MapPageWrapper'
import { pageMeta } from '@/lib/seo/pageMeta'

export const metadata = pageMeta({
  title: '덕질 지도',
  description: '내 주변 굿즈샵과 팝업스토어·콜라보 카페를 지도에서 바로 찾아보세요.',
  path: '/map',
})

export default function Page() {
  return <MapPageWrapper />
}
