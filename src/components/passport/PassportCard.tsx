'use client'
import { useState, useRef } from 'react'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/tds'
import ProfileCustomizationModal from './ProfileCustomizationModal'
import { setTagline } from '@/services/cosmeticService'
import { OtakuPassport } from '@/services/passportService'
import { RARITY_COLOR } from '@/services/badgeService'
import { useWorn } from '@/components/cosmetic/CosmeticProvider'
import { UserAvatar } from '@/components/cosmetic/UserFace'
import { bgStyle, fxClass } from '@/lib/cosmetics/style'
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
  previewWorn?: any
}

export default function PassportCard({ passport, isOwner, onCustomizeClick, previewWorn }: Props) {
  const router = useRouter()
  const [showEdit, setShowEdit] = useState(false)
  const [nickname, setNickname] = useState(passport.nickname)
  const [tagline, setTagline2] = useState(passport.tagline)
  const [avatarUrl, setAvatarUrl] = useState(passport.avatarUrl)
  const realWorn = useWorn(passport.userId)
  const worn = (previewWorn && (previewWorn.frame || previewWorn.background || previewWorn.title)) ? { frame: previewWorn.frame ?? realWorn.frame, background: previewWorn.background ?? realWorn.background, title: previewWorn.title ?? realWorn.title, effect: realWorn.effect } : realWorn

  const issuedDate = new Date(passport.issuedAt).toLocaleDateString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).replace(/\. /g, '.').replace(/\.$/, '')

  /* ⭐ 테마는 없앴다 — 아무것도 안 바꾸는 코스메틱은 보상이 아니라 노이즈다.
     배경이 프로필 카드를 책임진다. 역할이 하나로 정리됐다. */
  const skin = bgStyle(worn.background?.slug, worn.background?.assetUrl)
  const dressed = Boolean(worn.background)

  return (
    <div
      className={[styles.card, dressed ? styles.dressed : '', fxClass(worn.effect?.slug)].join(' ')}
      style={skin}
    >
      {/* 여권 헤더 */}
      <div className={styles.head}>
        <div className={styles.brand}>TAKUROAD PASSPORT</div>
        <div className={styles.meta}>
          <span>No. {passport.passportNumber}</span>
          <span>Issued {issuedDate}</span>
        </div>
      </div>

      <p className={styles.tagline}>
        &quot;{isOwner ? tagline : passport.tagline}&quot;
        {isOwner && (
          <button className={styles.tagEditBtn} onClick={() => setShowEdit(true)} aria-label='프로필 수정'>
            <svg viewBox='0 0 24 24' width='13' height='13' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><path d='M12 20h9'/><path d='M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z'/></svg>
          </button>
        )}
      </p>

      {/* 얼굴 — 프레임 + 효과 */}
      <div className={styles.face}>
        <div className={styles.avatarWrap}>
          <UserAvatar
            userId={passport.userId}
            src={isOwner ? avatarUrl : passport.avatarUrl}
            name={passport.nickname}
            size={88}
          />
          {isOwner && (
            <button className={styles.avatarEdit} onClick={() => setShowEdit(true)} aria-label='프로필 수정'>
              <svg viewBox='0 0 24 24' width='15' height='15' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><path d='M12 20h9'/><path d='M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z'/></svg>
            </button>
          )}
        </div>
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
        <StatBox icon="colorshop" label="방문한 샵" value={passport.visitedShopCount} />
        <StatBox icon="colorstar" label="작성한 리뷰" value={passport.reviewCount} />
        <StatBox icon="colorcollection" label="획득 배지" value={passport.totalBadgeCount} />
        <StatBox icon="colorroute" label="완주한 루트" value={passport.pilgrimageCount} />
      </div>

      {passport.recentVisits && passport.recentVisits.length > 0 && (
        <div className={styles.recent}>
          <div className={styles.recentHead}>최근 방문</div>
          <div className={styles.recentRow}>
            {passport.recentVisits.map((v, i) => (
              <Link key={i} href={'/shop/' + v.slug} className={styles.recentItem}>
                <div className={styles.recentThumb}>
                  {v.image ? <img src={v.image} /> : <span className={styles.recentNo}>?</span>}
                </div>
                <span className={styles.recentName}>{v.name}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 가장 많이 찾은 작품 */}
      {/* 가장 좋아하는 작품 + 대표 배지 (시안 하단 2칸) */}
      <div className={styles.favRow}>
        {passport.topVisitedSeries.length > 0 && (
          <div className={styles.favWork}>
            <div className={styles.favHead}><span>최애 작품</span>{isOwner && <button className={styles.favEdit} onClick={() => router.push('/cosmetic?tab=work')}>변경하기 ›</button>}</div>
            <div className={styles.favWorkBody}>
              <div className={styles.favPoster}>
                {passport.topVisitedSeries[0].cover
                  ? <img src={passport.topVisitedSeries[0].cover} />
                  : <span className={styles.favNo}>?</span>}
              </div>
              <div className={styles.favInfo}>
                <div className={styles.favName}>{passport.topVisitedSeries[0].name}</div>
                <div className={styles.favCount}>관련 샵 {passport.topVisitedSeries[0].count}곳</div>
              </div>
            </div>
          </div>
        )}
        <div className={styles.favBadge}>
          <div className={styles.favHead}><span>대표 배지</span>{isOwner && <button className={styles.favEdit} onClick={() => router.push('/cosmetic?tab=showcase')}>변경하기 ›</button>}</div>
          {passport.featuredBadges.length > 0 ? (
            <div className={styles.favBadgeRow}>
              {passport.featuredBadges.map((b, i) => (
                <span
                  key={i}
                  className={styles.favBadgeChip}
                  style={{ borderColor: RARITY_COLOR[b.rarity as keyof typeof RARITY_COLOR] ?? 'var(--border)' }}
                >
                  {b.iconUrl && <img src={b.iconUrl} />}
                </span>
              ))}
            </div>
          ) : isOwner ? (
            <button className={styles.favEmpty} onClick={onCustomizeClick}>대표 배지를 골라주세요 ›</button>
          ) : (
            <div className={styles.favEmptyText}>아직 대표 배지가 없어요</div>
          )}
        </div>
      </div>
      {showEdit && (
        <ProfileCustomizationModal
          passport={passport}
          userId={passport.userId}
          onClose={() => setShowEdit(false)}
          onSaved={(v) => { setNickname(v.nickname); setTagline2(v.tagline) }}
        />
      )}
    </div>
  )
}

function StatBox({ icon, label, value }: { icon: string; label: string; value: number }) {
  return (
    <div className={styles.stat}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statTop}><Icon name={icon} size={22} /><span className={styles.statValue}>{value}</span></div>
    </div>
  )
}