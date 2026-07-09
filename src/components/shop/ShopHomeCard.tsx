'use client'
import { useRouter } from 'next/navigation'
import { ROUTES } from '@/lib/constants/routes'
import { shopRegion, shopDistrict } from '@/lib/utils/region'
import { ShopHomeItem } from '@/services/shopHomeService'
import styles from './ShopHomeCard.module.css'

/** 2100 → 2.1k. 찜 수가 네 자리를 넘으면 카드가 흔들린다 */
export const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))

export const placeLabel = (s: ShopHomeItem) => {
  const region = shopRegion({ region: s.region, addr: s.addr })
  const district = shopDistrict({ district: s.district, addr: s.addr })
  return [region, district].filter(Boolean).join(' ') || '지역 미등록'
}

/* ───────── 큰 카드 : 지금 핫한 샵 ───────── */

export default function ShopHomeCard({ shop, rank }: { shop: ShopHomeItem; rank?: number }) {
  const router = useRouter()
  const cover = shop.images[0] ?? null

  return (
    <article className={styles.card} onClick={() => router.push(ROUTES.shop(shop.slug))}>
      <div className={styles.thumb}>
        {cover ? <img src={cover} alt="" /> : <div className={styles.noImage}>사진 준비 중</div>}
        {rank != null && (
          <span className={rank <= 3 ? styles.rankHot : styles.rank}>
            {rank <= 3 ? `HOT ${rank}` : rank}
          </span>
        )}
      </div>

      <div className={styles.body}>
        <h3 className={styles.name} title={shop.name}>{shop.name}</h3>
        <p className={styles.place}>{placeLabel(shop)}</p>

        <div className={styles.stats}>
          <span className={styles.rating}>
            <Star />
            <strong>{shop.rating_avg ? shop.rating_avg.toFixed(1) : '-'}</strong>
            {shop.rating_count > 0 && <em>({compact(shop.rating_count)})</em>}
          </span>
          <span className={styles.saves}>
            <Heart />{compact(shop.bookmark_count)}
          </span>
        </div>

        <div className={styles.chips}>
          {shop.cat && <span className={styles.chip}>{shop.cat}</span>}
          {shop.works[0] && <span className={styles.chipWork}>{shop.works[0].name}</span>}
        </div>
      </div>
    </article>
  )
}

/* ───────── 작은 카드 : 새로 등록 / 이벤트 있는 샵 ───────── */

export function ShopMiniCard({
  shop, badge, badgeTone = 'new', sub,
}: {
  shop: ShopHomeItem
  badge: string
  badgeTone?: 'new' | 'event'
  /** 두 번째 줄 — 지역이거나 이벤트 제목 */
  sub: string
}) {
  const router = useRouter()
  const cover = shop.images[0] ?? null

  return (
    <article className={styles.mini} onClick={() => router.push(ROUTES.shop(shop.slug))}>
      <div className={styles.miniThumb}>
        {cover ? <img src={cover} alt="" /> : <div className={styles.noImage} />}
        <span className={badgeTone === 'event' ? styles.badgeEvent : styles.badgeNew}>{badge}</span>
      </div>
      <div className={styles.miniBody}>
        <h4 className={styles.miniName} title={shop.name}>{shop.name}</h4>
        <p className={styles.miniSub} title={sub}>{sub}</p>
      </div>
    </article>
  )
}

/* ───────── 아이콘 ───────── */

const Star = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="#F5B100" stroke="none">
    <path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17.8 6.8 19.2l1-5.8L3.5 9.2l5.9-.9z" />
  </svg>
)

const Heart = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="#FF6B6B" stroke="none">
    <path d="M12 20C5 15 3.5 10.5 5.5 7.8 7.1 5.9 10.2 6.1 12 8.4 13.8 6.1 16.9 5.9 18.5 7.8 20.5 10.5 19 15 12 20Z" />
  </svg>
)
