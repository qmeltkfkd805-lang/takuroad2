import EventCalendarPage from '@/components/event/EventCalendarPage'
import { pageMeta } from '@/lib/seo/pageMeta'

// 제목 뒤 '| 타쿠로드'는 layout 이 붙인다 (예전엔 '이벤트 캘린더 · 타쿠로드 | 타쿠로드'로 두 번 붙었다)
export const metadata = pageMeta({
  title: '이벤트 캘린더',
  description: '애니·게임 팝업스토어, 콜라보 카페, 전시 일정을 달력으로 한눈에 확인하세요.',
  path: '/events/calendar',
})

export default function Page() {
  return <EventCalendarPage />
}
