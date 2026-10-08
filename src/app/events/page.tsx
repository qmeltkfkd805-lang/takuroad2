import EventHomePage from '@/components/event/EventHomePage'
import { pageMeta } from '@/lib/seo/pageMeta'

export const metadata = pageMeta({
  title: '덕질 이벤트',
  description: '지금 열리는 애니·게임 팝업스토어, 콜라보 카페, 전시, 행사를 기간·지역별로 모아봤어요.',
  path: '/events',
})

export default function Page() {
  return <EventHomePage />
}
