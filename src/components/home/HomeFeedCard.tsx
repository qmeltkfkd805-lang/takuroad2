'use client'

import Link from 'next/link'
import { FeedItem, FeedTone } from '@/lib/feed/types'
import { WorkIcon } from '@/components/tds/WorkIcon'
import styles from './HomeFeedCard.module.css'

// tone → 색 (소식 뱃지 알약 + 강조)
const TONE: Record<FeedTone, { bg: string; fg: string }> = {
  coral:    { bg: '#FFEDE6', fg: '#C0392B' },
  blue:     { bg: '#E8F4FF', fg: '#1A5F95' },
  mint:     { bg: '#E1F7F2', fg: '#0E7A63' },
  gold:     { bg: '#FFF3D6', fg: '#946400' },
  lavender: { bg: '#F0ECFF', fg: '#5A43B5' },
  gray:     { bg: '#F1EFEA', fg: '#8A857C' },
}

// 소식 종류 → 뱃지 라벨 + 점 색
const KIND_BADGE: Record<string, { label: string; dot: string }> = {
  event:      { label: '새 이벤트', dot: '#FF5692' },
  goods:      { label: '굿즈 입고', dot: '#F5A300' },
  popup:      { label: '팝업 진행', dot: '#3B9BE8' },
  route:      { label: '새 루트',   dot: '#1FAE8C' },
  collection: { label: '컬렉션',    dot: '#8B6BD9' },
  checkin:    { label: '체크인',    dot: '#3B9BE8' },
  notice:     { label: '업데이트',  dot: '#1FAE8C' },
  none:       { label: '새 소식 없음', dot: '#C7C2BA' },
}

// 작품명 첫 두 글자 (커버 없을 때 색블록에)
function initials(name?: string) {
  return (name ?? '').slice(0, 2)
}

export default function HomeFeedCard({ item }: { item: FeedItem }) {
  const tone = TONE[item.tone]
  const badge = KIND_BADGE[item.kind] ?? KIND_BADGE.none

  const inner = (
    <div className={styles.card}>
      {/* 상단 비주얼: 이미지 있으면 이미지, 없으면 색블록+이니셜 */}
      <div className={styles.visual} style={{ background: item.imageUrl ? undefined : tone.bg }}>
        {item.imageUrl ? (
          <img src={item.imageUrl} alt="" className={styles.cover} draggable={false} />
        ) : (
          <WorkIcon size={36} style={{ opacity: 0.45 }} />
        )}
        {item.contextAffinity && (
          <span className={styles.affBadge}>
            {item.contextAffinity === 'favorite' ? (
              <svg viewBox="0 0 24 24" style={{ fill: '#FF6B6B' }}><path d="M12 20C5 15 3.5 10.5 5.5 7.8 7.1 5.9 10.2 6.1 12 8.4 13.8 6.1 16.9 5.9 18.5 7.8 20.5 10.5 19 15 12 20Z" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" style={{ fill: '#FFD166' }}><path d="M12 3.5l2.5 5.6 6.1.5-4.6 4 1.4 6-5.4-3.2-5.4 3.2 1.4-6-4.6-4 6.1-.5z" /></svg>
            )}
          </span>
        )}
      </div>

      {/* 본문 */}
      <div className={styles.body}>
        {item.contextLabel && <div className={styles.work}>{item.contextLabel}</div>}
        <span className={styles.badge} style={{ background: tone.bg, color: tone.fg }}>
          <span className={styles.dot} style={{ background: badge.dot }} />
          {badge.label}
        </span>
        <div className={styles.title}>{item.title}</div>
        {item.subtitle && <div className={styles.subtitle}>{item.subtitle}</div>}
      </div>
    </div>
  )

  if (item.href) {
    return <Link href={item.href} className={styles.link}>{inner}</Link>
  }
  return <div className={styles.link}>{inner}</div>
}
