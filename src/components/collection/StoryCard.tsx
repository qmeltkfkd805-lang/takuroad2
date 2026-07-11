'use client'

import { useRouter } from 'next/navigation'
import { Story } from '@/services/storyBuilder'
import styles from './StoryCard.module.css'

const TYPE_ICON: Record<string, string> = {
  shop_visit: '🏪',
  event_visit: '🎪',
  cafe_visit: '☕',
}
const TYPE_LABEL: Record<string, string> = {
  shop_visit: '방문',
  event_visit: '참여',
  cafe_visit: '방문',
}

export default function StoryCard({ story }: { story: Story }) {
  const router = useRouter()
  const [y, m, d] = story.date.split('-')

  return (
    <article className={styles.card}>
      <header className={styles.head}>
        <div className={styles.area}>
          <span className={styles.pin}>📍</span>
          <h3>{story.area}</h3>
        </div>
        <time className={styles.date}>{y}.{m}.{d}</time>
      </header>

      <div className={styles.body}>
        {story.places.map((place, i) => (
          <div key={i} className={styles.placeGroup}>
            {place.placeName && (
              <div className={styles.placeName}>
                <span>📌</span> {place.placeName}
              </div>
            )}
            <ul className={place.placeName ? styles.itemsNested : styles.items}>
              {place.items.map(item => (
                <li
                  key={item.id}
                  className={styles.item}
                  style={{ cursor: item.slug ? 'pointer' : 'default' }}
                  onClick={() => item.slug && router.push(`/shop/${item.slug}`)}
                >
                  <span className={styles.icon}>{TYPE_ICON[item.type] ?? '✨'}</span>
                  <span className={styles.name}>{item.name}</span>
                  <span className={styles.label}>{TYPE_LABEL[item.type] ?? ''}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {story.highlight ? (
        <footer className={styles.highlight}>
          <div className={styles.hlLabel}>✨ 이번 기록</div>
          <div className={styles.hlMain}>
            <span className={styles.hlName}>{story.highlight.name}</span>
            <span className={styles.hlSub}>
              관련 장소 {story.highlight.visited}곳 방문
            </span>
          </div>
          <div className={styles.bar}>
            <span style={{ width: `${story.highlight.pct}%` }} />
          </div>
          <div className={styles.hlPct}>
            탐험도 {story.highlight.pct}%
            <span className={styles.hlCount}>({story.highlight.visited}/{story.highlight.total})</span>
          </div>

          {story.highlight.nextShopName && (
            <div
              className={styles.next}
              onClick={() => story.highlight?.slug && router.push(`/shops/all?works=${story.highlight.slug}`)}
            >
              <span className={styles.nextLabel}>다음</span>
              <span className={styles.nextText}>
                <b>{story.highlight.nextShopName}</b> 방문 시 {story.highlight.nextPct}%
              </span>
              <span className={styles.nextArrow}>›</span>
            </div>
          )}
        </footer>
      ) : (
        <footer className={styles.foot}>
          {story.area}에서 {story.totalCount}곳
        </footer>
      )}
    </article>
  )
}
