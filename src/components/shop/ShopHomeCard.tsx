'use client'
import VerifiedBadge from './VerifiedBadge'
import { useRouter } from 'next/navigation'
import { ROUTES } from '@/lib/constants/routes'
import { shopRegion, shopDistrict } from '@/lib/utils/region'
import { ShopHomeItem } from '@/services/shopHomeService'
import { MapEvent, MAP_EVENT_TYPE_LABEL } from '@/services/mapEventService'
import { CATEGORY_NAME_MAP } from '@/lib/constants/categories'
import styles from './ShopHomeCard.module.css'

/** 2100 → 2.1k. 찜 수가 네 자리를 넘으면 카드가 흔들린다 */
export const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))

export const placeLabel = (s: ShopHomeItem) => {
  const region = shopRegion(s)
  const district = shopDistrict(s)
  return [region, district].filter(Boolean).join(' ') || '지역 미등록'
}

/* ───────── 큰 카드 : 지금 핫한 샵 ───────── */

export default function ShopHomeCard({ shop, rank }: { shop: ShopHomeItem; rank?: number }) {
  const router = useRouter()
  // 샵 사진이 우선. 없으면 진행 중 이벤트 포스터로 채운다.
  const shopPhoto = shop.images[0] ?? null
  const cover = shopPhoto ?? shop.eventCover ?? null
  // 이벤트 포스터는 세로형이 많아 4:3에서 잘린다 → 안 자르고 통째로(contain)
  const isPoster = !shopPhoto && !!shop.eventCover

  return (
    <article className={styles.card} onClick={() => router.push(ROUTES.shop(shop.slug))}>
      <div className={`${styles.thumb} ${isPoster ? styles.thumbContain : ''}`}>
        {cover ? <img src={cover} alt="" loading="lazy" /> : <div className={styles.noImage}>사진 준비 중</div>}
        {rank != null && (
          <span className={rank <= 3 ? styles.rankHot : styles.rank}>
            {rank <= 3 ? `HOT ${rank}` : rank}
          </span>
        )}
      </div>

      <div className={styles.body}>
        <h3 className={styles.name} title={shop.name}>{shop.name}{(shop as any).is_claimed && <span style={{ marginLeft: 4, display: 'inline-flex', verticalAlign: 'middle' }}><VerifiedBadge size={14} /></span>}</h3>
        <p className={styles.place}>{placeLabel(shop)}</p>

        <div className={styles.stats}>
          {shop.rating_count > 0 ? (
            <span className={styles.rating} title="별점">
              <Star />
              <strong>{(shop.rating_avg ?? 0).toFixed(1)}</strong>
              <em>후기 {compact(shop.rating_count)}</em>
            </span>
          ) : (
            <span className={styles.noReview}>아직 후기가 없어요</span>
          )}
          <span className={styles.saves} title="찜">
            <Heart />찜 {compact(shop.bookmark_count)}
          </span>
        </div>

        <div className={styles.chips}>
          {shop.cats.slice(0, 2).map(c => {
            const ci = CATEGORY_NAME_MAP[c]
            return (
              <span key={c} className={styles.chip}
                style={ci ? { background: ci.bgColor, color: ci.color, borderColor: `${ci.color}33` } : undefined}>
                {c}
              </span>
            )
          })}
        </div>
      </div>
    </article>
  )
}

/* ───────── 이벤트 카드 : 샵 카드와 동일한 크기·크롭 (4:3 cover) ───────── */

const evFmtDate = (d: string) => { const p = d.split('-'); return p.length === 3 ? `${p[0].slice(2)}.${p[1]}.${p[2]}` : d }
const evPeriod = (s: string | null, e: string | null) =>
  s && e ? `${evFmtDate(s)} ~ ${evFmtDate(e)}` : e ? `~ ${evFmtDate(e)}` : s ? `${evFmtDate(s)} ~` : null

const EV_CHIP_CAT: Record<string, string> = { popup: '팝업스토어', collab_cafe: '콜라보카페', exhibition: '전시', official_event: '행사' }

export function EventHomeCard({ event, onClick }: { event: MapEvent; onClick: () => void }) {
  const label = event.type ? (MAP_EVENT_TYPE_LABEL[event.type] ?? '이벤트') : '이벤트'
  const evCi = event.type ? CATEGORY_NAME_MAP[EV_CHIP_CAT[event.type]] : undefined
  const period = evPeriod(event.startDate, event.endDate)
  return (
    <article className={styles.card} onClick={onClick}>
      <div className={styles.thumb}>
        {event.coverUrl ? <img src={event.coverUrl} alt="" /> : <div className={styles.noImage}>이벤트</div>}
      </div>
      <div className={styles.body}>
        <h3 className={styles.name} title={event.title}>{event.title}</h3>
        {period && <p className={styles.place}>🗓 {period}</p>}
        <p className={styles.place}>{event.address ?? '장소 미정'}</p>
        <div className={styles.chips}>
          <span className={styles.chip}
            style={evCi ? { background: evCi.bgColor, color: evCi.color, borderColor: `${evCi.color}33` } : undefined}>
            {label}
          </span>
        </div>
      </div>
    </article>
  )
}

/* ───────── 작은 카드 : 새로 등록 / 이벤트 있는 샵 ───────── */

export function ShopMiniCard({
  shop, badge, badgeTone = 'new', sub, image,
}: {
  shop: ShopHomeItem
  badge: string
  badgeTone?: 'new' | 'event'
  /** 두 번째 줄 — 지역이거나 이벤트 제목 */
  sub: string
  /** 카드 이미지 강제 지정 — 이벤트 줄은 샵 사진 대신 이벤트 포스터를 넣는다 */
  image?: string | null
}) {
  const router = useRouter()
  const cover = image ?? shop.images[0] ?? shop.eventCover ?? null

  return (
    <article className={styles.mini} onClick={() => router.push(ROUTES.shop(shop.slug))}>
      <div className={styles.miniThumb}>
        {cover ? <img src={cover} alt="" loading="lazy" /> : <div className={styles.noImage} />}
        <span className={badgeTone === 'event' ? styles.badgeEvent : styles.badgeNew}>{badge}</span>
      </div>
      <div className={styles.miniBody}>
        <h4 className={styles.miniName} title={shop.name}>{shop.name}{(shop as any).is_claimed && <span style={{ marginLeft: 3, display: 'inline-flex', verticalAlign: 'middle' }}><VerifiedBadge size={12} /></span>}</h4>
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