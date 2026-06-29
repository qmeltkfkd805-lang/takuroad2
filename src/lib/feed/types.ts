// FeedItem — 앱 전체 공용 피드 모델
// "무언가가 발생한 기록" 하나. 홈/작품홈/샵상세/알림/프로필 등 피드성 화면이 공유.
// 도메인이 FeedItem으로 변환(toEventFeed 등) → 화면이 정책으로 선택(pickWorkNews 등)
// → 화면별 카드가 그림(HomeFeedCard 등). 모델은 공용, UI는 역할별 분리.

export type FeedKind =
  | 'event' | 'goods' | 'popup' | 'route' | 'collection' | 'checkin' | 'notice' | 'none'

export type FeedTone = 'coral' | 'blue' | 'mint' | 'gold' | 'lavender' | 'gray'

export interface FeedItem {
  kind: FeedKind
  title: string
  subtitle?: string
  icon: string
  tone: FeedTone
  href?: string
  contextLabel?: string
  imageUrl?: string | null   // 작품 커버(있으면 카드 상단에 표시)
  contextAffinity?: 'favorite' | 'interest'  // 카드가 SVG로 그림
}
