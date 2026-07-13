'use client'

import { OtakuPassport } from '@/services/passportService'
import { RARITY_COLOR } from '@/services/badgeService'
import { useWorn } from '@/components/cosmetic/CosmeticProvider'
import { UserAvatar } from '@/components/cosmetic/UserFace'
import { bgStyle, themeStyle } from '@/lib/cosmetics/style'
import styles from './PassportCard.module.css'

/* 오타쿠 여권 — 프로필의 얼굴

   ⭐ 여권 세계관(No. · Issued · tagline)은 SDS 자산이라 그대로 둔다.
   ⭐ 대신 코스메틱을 입힌다 — 배경/테마가 카드 자체를 바꾸고,
      프레임·효과가 아바타에, 칭호와 대표 배지가 이름 아래 붙는다.
      밤하늘 배경을 끼면 여권이 밤하늘이 된다. 그게 꾸미는 재미의 완성이다.

   ⭐⭐ 칭호(equipped.title)와 대표 배지(equipped.showcase)는 다른 것이다.
      칭호   = 내가 고른 이름     "덕질 장인"
      대표배지 = 내가 자랑할 성취   "리뷰 마스터 Lv3"
      옛 명패(selected_title_id)와 옛 대표배지(is_featured)는 여기로 통합됐다.
      설정은 /cosmetic 한 곳에서만 한다. */

interface Props {
  passport: OtakuPassport
  isOwner?: boolean
  onCustomizeClick?: () => void
}

export default function PassportCard({ passport, isOwner, onCustomizeClick }: Props) {
  const worn = useWorn(passport.userId)

  const issuedDate = new Date(passport.issuedAt).toLocaleDateString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).replace(/\. /g, '.').replace(/\.$/, '')

  const hasImage = Boolean(worn.background?.assetUrl)
  const skin = {
    ...themeStyle(worn.theme?.slug, hasImage),
    ...bgStyle(worn.background?.slug, worn.background?.assetUrl),
  }
  const dressed = Boolean(worn.theme || worn.background)

  return (
    <div className={[styles.card, dressed ? styles.dressed : ''].join(' ')} style={skin}>
      {/* 여권 헤더 */}
      <div className={styles.head}>
        <div className={styles.brand}>TAKUROAD PASSPORT</div>
        <div className={styles.meta}>
          <span>No. {passport.passportNumber}</span>
          <span>Issued {issuedDate}</span>
        </div>
      </div>

      <p className={styles.tagline}>&quot;{passport.tagline}&quot;</p>

      {/* 얼굴 — 프레임 + 효과 */}
      <div className={styles.face}>
        <UserAvatar
          userId={passport.userId}
          src={passport.avatarUrl}
          name={passport.nickname}
          size={88}
        />
        <div className={styles.nick}>{passport.nickname}</div>

        {worn.title && <div className={styles.title}>{worn.title.name}</div>}

        {/* 대표 배지 — 최대 3개 진열 */}
        {passport.featuredBadges.length > 0 ? (
          <div className={styles.showRow}>
            {passport.featuredBadges.map((b, i) => (
              <span
                key={i}
                className={styles.showChip}
                style={{ borderColor: RARITY_COLOR[b.rarity as keyof typeof RARITY_COLOR] ?? 'var(--border)' }}
              >
                {b.iconUrl && <img src={b.iconUrl} alt="" />}
                {b.name}
              </span>
            ))}
          </div>
        ) : isOwner ? (
          <button className={styles.setBtn} onClick={onCustomizeClick}>
            프로필 꾸미기 ›
          </button>
        ) : null}

        {isOwner && passport.featuredBadges.length > 0 && (
          <button className={styles.editBtn} onClick={onCustomizeClick}>
            꾸미기 변경
          </button>
        )}
      </div>

      {/* 기록 도장 */}
      <div className={styles.stats}>
        <StatBox label="방문" value={passport.visitedShopCount} />
        <StatBox label="순례" value={passport.pilgrimageCount} />
        <StatBox label="배지" value={passport.totalBadgeCount} />
        <StatBox label="후기" value={passport.reviewCount} />
      </div>

      {/* 첫 성지 / 최근 성지 */}
      {(passport.firstShop || passport.latestShop) && (
        <div className={styles.shrine}>
          {passport.firstShop && (
            <div>
              첫 성지 · <strong>{passport.firstShop.name}</strong>
              {' '}({new Date(passport.firstShop.date).toLocaleDateString('ko-KR')})
            </div>
          )}
          {passport.latestShop && (
            <div>
              최근 성지 · <strong>{passport.latestShop.name}</strong>
              {' '}({new Date(passport.latestShop.date).toLocaleDateString('ko-KR')})
            </div>
          )}
        </div>
      )}

      {/* 가장 많이 찾은 작품 */}
      {passport.topVisitedSeries.length > 0 && (
        <div className={styles.series}>
          <div className={styles.seriesHead}>가장 많이 찾은 작품</div>
          {passport.topVisitedSeries.map((s, i) => (
            <div key={s.name} className={styles.seriesRow}>
              <span>{i + 1}. {s.name}</span>
              <span className={styles.seriesCount}>{s.count}곳</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.stat}>
      <div className={styles.statValue}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  )
}
