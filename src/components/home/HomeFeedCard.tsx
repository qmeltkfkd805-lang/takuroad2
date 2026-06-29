'use client'

import Link from 'next/link'
import { FeedItem, FeedTone } from '@/lib/feed/types'
import styles from './HomeFeedCard.module.css'

// tone → 색 매핑 (배경 틴트 / 강조색). 카드의 유일한 "변환" 책임.
const TONE: Record<FeedTone, { bg: string; fg: string }> = {
  coral:    { bg: '#FFEDE6', fg: '#C0392B' },
  blue:     { bg: '#E8F4FF', fg: '#1A5F95' },
  mint:     { bg: '#E1F7F2', fg: '#0E7A63' },
  gold:     { bg: '#FFF3D6', fg: '#946400' },
  lavender: { bg: '#F0ECFF', fg: '#5A43B5' },
  gray:     { bg: '#F1EFEA', fg: '#8A857C' },
}

export default function HomeFeedCard({ item }: { item: FeedItem }) {
  const tone = TONE[item.tone]

  const inner = (
    <div className={styles.card}>
      <div className={styles.head}>
        {item.contextLabel && (
          <span className={styles.context}>
            {item.contextAffinity === 'favorite' && (
              <svg className={styles.aff} viewBox="0 0 24 24" style={{ fill: '#FF6B6B' }}><path d="M12 20C5 15 3.5 10.5 5.5 7.8 7.1 5.9 10.2 6.1 12 8.4 13.8 6.1 16.9 5.9 18.5 7.8 20.5 10.5 19 15 12 20Z" /></svg>
            )}
            {item.contextAffinity === 'interest' && (
              <svg className={styles.aff} viewBox="0 0 24 24" style={{ fill: '#FFD166' }}><path d="M12 3.5l2.5 5.6 6.1.5-4.6 4 1.4 6-5.4-3.2-5.4 3.2 1.4-6-4.6-4 6.1-.5z" /></svg>
            )}
            {item.contextLabel}
          </span>
        )}
      </div>

      <div className={styles.body}>
        <span className={styles.iconBox} style={{ background: tone.bg }}>
          <span className={styles.icon} style={{ background: tone.fg, WebkitMaskImage: 'url(/icons/' + item.icon + '.png)', maskImage: 'url(/icons/' + item.icon + '.png)' }} />
        </span>
        <div className={styles.text}>
          <div className={styles.title}>{item.title}</div>
          {item.subtitle && <div className={styles.subtitle}>{item.subtitle}</div>}
        </div>
      </div>

      {item.href && <div className={styles.cta} style={{ color: tone.fg }}>지금 보기 →</div>}
    </div>
  )

  if (item.href) {
    return <Link href={item.href} className={styles.link}>{inner}</Link>
  }
  return inner
}
