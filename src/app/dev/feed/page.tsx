'use client'

import HomeFeedCard from '@/components/home/HomeFeedCard'
import { FeedItem } from '@/lib/feed/types'

const SAMPLES: FeedItem[] = [
  { kind: 'event', title: '새로운 팝업이 시작되었어요', subtitle: '애니메이트 홍대점 · ~06.15', icon: 'event', tone: 'coral', href: '/events/1', contextLabel: '원피스', contextAffinity: 'favorite' },
  { kind: 'goods', title: '새 굿즈가 입고됐어요', subtitle: '아크릴 스탠드 외 7종', icon: 'goods', tone: 'gold', href: '/work/x', contextLabel: '주술회전', contextAffinity: 'favorite' },
  { kind: 'popup', title: '팝업 진행 중', subtitle: '더현대 서울 B2', icon: 'popup', tone: 'blue', href: '/events/2', contextLabel: '블루아카이브', contextAffinity: 'interest' },
  { kind: 'route', title: '새 추천 루트가 생겼어요', subtitle: '홍대 덕질 코스 · 4곳', icon: 'route', tone: 'mint', href: '/routes/3', contextLabel: '하이큐!!', contextAffinity: 'favorite' },
  { kind: 'collection', title: '컬렉션을 완성했어요', subtitle: '굿즈 12/12', icon: 'collection', tone: 'lavender', href: '/profile', contextLabel: '체인소 맨', contextAffinity: 'interest' },
  { kind: 'checkin', title: '최근 체크인했어요', subtitle: '굿즈플래닛 · 1일 전', icon: 'checkin', tone: 'blue', href: '/shop/x', contextLabel: '스파이 패밀리', contextAffinity: 'favorite' },
  { kind: 'notice', title: '작품 정보가 업데이트됐어요', subtitle: '신규 태그 3개', icon: 'news', tone: 'mint', href: '/work/y', contextLabel: '바이올렛 에버가든', contextAffinity: 'interest' },
  { kind: 'none', title: '오늘은 새로운 소식이 없어요', icon: 'star', tone: 'gray', contextLabel: '나루토', contextAffinity: 'favorite' },
]

export default function DevFeedPage() {
  return (
    <div style={{ padding: '32px 24px', maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 900, marginBottom: 6 }}>Feed 쇼케이스</h1>
      <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 28 }}>
        FeedItem(JSON) ↔ HomeFeedCard 나란히. 정책이 만든 데이터가 카드로 어떻게 그려지는지 검증.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {SAMPLES.map((item, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 230px', gap: 20, alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 20 }}>
            <pre style={{ margin: 0, fontSize: 12, lineHeight: 1.6, background: 'var(--surface2)', padding: 14, borderRadius: 12, overflow: 'auto' }}>
{JSON.stringify(item, null, 2)}
            </pre>
            <HomeFeedCard item={item} />
          </div>
        ))}
      </div>
    </div>
  )
}
