'use client'
import VerifiedBadge from './VerifiedBadge'
import AppIcon from '@/components/tds/AppIcon'
import { shopRegion, shopDistrict } from '@/lib/utils/region'
import { getShopStatus, ShopStatusKind } from '@/lib/utils/shopStatus'
import { ShopHomeItem } from '@/services/shopHomeService'
import { MapEvent, MAP_EVENT_TYPE_LABEL } from '@/services/mapEventService'
import { CATEGORY_NAME_MAP } from '@/lib/constants/categories'
import styles from './ShopResultCards.module.css'

export type CardView = 'grid' | 'list'

const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))

export const placeLabel = (s: ShopHomeItem) =>
  [shopRegion(s), shopDistrict(s)].filter(Boolean).join(' ') || '지역 미등록'

/* 영업 상태 → 배지 (없으면 null → 배지 숨김) */
function shopBadge(kind: ShopStatusKind): { text: string; tone: 'open' | 'soon' | 'before' | 'off' } | null {
  switch (kind) {
    case 'open': return { text: '영업 중', tone: 'open' }
    case 'closing_soon': return { text: '곧 마감', tone: 'soon' }
    case 'before': return { text: '영업 전', tone: 'before' }
    case 'dayoff': return { text: '휴무', tone: 'off' }
    case 'temp_closed': return { text: '임시 휴무', tone: 'off' }
    case 'closed': return { text: '영업 종료', tone: 'off' }
    case 'permanently_closed': return { text: '폐점', tone: 'off' }
    default: return null
  }
}

const Star = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="#F5B100" stroke="none" aria-hidden>
    <path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17.8 6.8 19.2l1-5.8L3.5 9.2l5.9-.9z" />
  </svg>
)

function Tags({ cats }: { cats: string[] }) {
  return (
    <div className={styles.tags}>
      {cats.slice(0, 2).map(c => {
        const ci = CATEGORY_NAME_MAP[c]
        return (
          <span key={c} className={styles.tag}
            style={ci ? { background: ci.bgColor, color: ci.color } : undefined}>
            {c}
          </span>
        )
      })}
    </div>
  )
}

/* ───────── 샵 카드 (그리드 / 리스트 공용) ───────── */
export function ShopResultCard({
  shop, view, saved, onOpen, onToggleSave, now = new Date(),
}: {
  shop: ShopHomeItem
  view: CardView
  saved: boolean
  onOpen: () => void
  onToggleSave: () => void
  now?: Date
}) {
  const cover = shop.images[0] ?? shop.eventCover ?? null
  const badge = shopBadge(getShopStatus(shop, now).kind)
  const verified = (shop as any).is_claimed || shop.is_verified

  const heart = (
    <button
      className={styles.heart}
      aria-label={saved ? '찜 해제' : '찜하기'}
      aria-pressed={saved}
      onClick={e => { e.stopPropagation(); onToggleSave() }}
    >
      <AppIcon name="heart" size={16} color={saved ? 'var(--accent)' : '#c4c0c8'} />
    </button>
  )

  const thumb = (
    <div className={styles.thumb}>
      {cover
        ? <img src={cover} alt="" loading="lazy" />
        : <div className={styles.noImage}>사진 준비 중</div>}
      {badge && <span className={styles.status} data-tone={badge.tone}>{badge.text}</span>}
      {heart}
    </div>
  )

  const name = (
    <h3 className={styles.name} title={shop.name}>
      {shop.name}
      {verified && <span className={styles.verified}><VerifiedBadge size={14} /></span>}
    </h3>
  )
  const rating = shop.rating_count > 0 ? (
    <span className={styles.rating}>
      <Star /><strong>{(shop.rating_avg ?? 0).toFixed(1)}</strong>
      <em>후기 {compact(shop.rating_count)}</em>
    </span>
  ) : null

  if (view === 'list') {
    return (
      <article className={styles.row} onClick={onOpen}>
        {thumb}
        <div className={styles.rowBody}>
          {name}
          <p className={styles.place}>{placeLabel(shop)}</p>
          <div className={styles.rowMeta}>
            {rating}
            <Tags cats={shop.cats} />
          </div>
        </div>
      </article>
    )
  }

  return (
    <article className={styles.card} onClick={onOpen}>
      {thumb}
      <div className={styles.body}>
        {name}
        <p className={styles.place}>{placeLabel(shop)}</p>
        {rating && <div className={styles.stats}>{rating}</div>}
        <Tags cats={shop.cats} />
      </div>
    </article>
  )
}

/* ───────── 이벤트 카드 (그리드 / 리스트 공용) ───────── */
const fmtDate = (d: string) => { const p = d.split('-'); return p.length === 3 ? `${p[0]}.${p[1]}.${p[2]}` : d }
const period = (s: string | null, e: string | null) =>
  s && e ? `${fmtDate(s)} – ${fmtDate(e)}` : e ? `~ ${fmtDate(e)}` : s ? `${fmtDate(s)} ~` : null

function eventBadge(s: string | null, e: string | null, todayISO: string): { text: string; tone: 'open' | 'before' | 'ended' } {
  if (s && todayISO < s) return { text: '진행 예정', tone: 'before' }
  if (e && todayISO > e) return { text: '종료', tone: 'ended' }
  return { text: '진행 중', tone: 'open' }
}

const EV_CHIP_CAT: Record<string, string> = { popup: '팝업스토어', collab_cafe: '콜라보카페', exhibition: '전시', official_event: '행사' }

export function EventResultCard({
  event, view, todayISO, onOpen,
}: {
  event: MapEvent
  view: CardView
  todayISO: string
  onOpen: () => void
}) {
  const label = event.type ? (MAP_EVENT_TYPE_LABEL[event.type] ?? '이벤트') : '이벤트'
  const ci = event.type ? CATEGORY_NAME_MAP[EV_CHIP_CAT[event.type]] : undefined
  const badge = eventBadge(event.startDate, event.endDate, todayISO)
  const range = period(event.startDate, event.endDate)
  const ended = badge.tone === 'ended'

  const thumb = (
    <div className={`${styles.thumb} ${ended ? styles.thumbEnded : ''}`}>
      {event.coverUrl
        ? <img src={event.coverUrl} alt="" loading="lazy" />
        : <div className={styles.noImage}>이벤트</div>}
      <span className={styles.status} data-tone={badge.tone}>{badge.text}</span>
    </div>
  )
  const tag = (
    <div className={styles.tags}>
      <span className={styles.tag} style={ci ? { background: ci.bgColor, color: ci.color } : undefined}>{label}</span>
    </div>
  )

  if (view === 'list') {
    return (
      <article className={`${styles.row} ${ended ? styles.rowEnded : ''}`} onClick={onOpen}>
        {thumb}
        <div className={styles.rowBody}>
          <h3 className={styles.name} title={event.title}>{event.title}</h3>
          <p className={styles.place}>{event.address ?? '장소 미정'}</p>
          <div className={styles.rowMeta}>
            {range && <span className={styles.evDate}>{range}</span>}
            {tag}
          </div>
        </div>
      </article>
    )
  }

  return (
    <article className={`${styles.card} ${ended ? styles.cardEnded : ''}`} onClick={onOpen}>
      {thumb}
      <div className={styles.body}>
        <h3 className={styles.name} title={event.title}>{event.title}</h3>
        <p className={styles.place}>{event.address ?? '장소 미정'}</p>
        {range && <p className={styles.evDate}>{range}</p>}
        {tag}
      </div>
    </article>
  )
}
