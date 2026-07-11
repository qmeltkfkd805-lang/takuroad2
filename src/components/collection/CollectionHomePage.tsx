'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { getCollectionHome, CollectionHome, StoryCardSummary, WorkCollection } from '@/services/collectionService'
import { Challenge, EarnedBadge } from '@/services/growthService'
import { AXIS_KEYS, AXIS_LABEL, AXIS_VERB } from '@/lib/work/workProgress'
import { Icon, Taku } from '@/components/tds'
import { MaskIcon } from './MaskIcon'
import { ROUTES } from '@/lib/constants/routes'
import styles from './CollectionHomePage.module.css'

/* 나의 덕질 컬렉션 — 회고 페이지가 아니라 "다음 행동을 만드는 대시보드"

   ⭐⭐ 순서가 곧 철학이다.
      통계 → [지금 도전 중] → 최근 기록 → 작품 탐험 → 최근 해금 배지
      들어왔을 때 가장 먼저 드는 생각이 "다음엔 뭘 하면 되지?"여야 한다.
      타쿠로드의 핵심은 사용자를 다시 밖으로 내보내는 것.

   ⭐ 그렇다고 업적 페이지처럼 보이면 안 된다.
      도전은 여기서 1~3개만 요약하고, 전체 배틀패스는 /growth로 뺀다. */

const WD = ['일', '월', '화', '수', '목', '금', '토']
function fmtDate(d: string) {
  const [y, m, dd] = d.split('-').map(Number)
  return `${m}.${dd} (${WD[new Date(y, m - 1, dd).getDay()]})`
}

export default function CollectionHomePage() {
  const { user } = useAuth()
  const router = useRouter()
  const [data, setData] = useState<CollectionHome | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    getCollectionHome(user.id).then(setData).catch(() => {}).finally(() => setLoading(false))
  }, [user])

  if (!user) {
    return (
      <div className={styles.page}>
        <div className={styles.signin}>
          <h1>나의 덕질 컬렉션</h1>
          <p>로그인하면 내가 다녀온 곳들이 기록으로 쌓여요.</p>
          <button onClick={() => router.push(ROUTES.login)}>로그인하기</button>
        </div>
      </div>
    )
  }

  const s = data?.summary
  const challenges = data?.challenges ?? []
  const stories = data?.stories ?? []
  const works = data?.works ?? []
  const badges = data?.badges ?? []

  const hero = challenges[0]
  const subs = challenges.slice(1, 3)

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <h1>나의 덕질 컬렉션 <Icon name="colorstar" size={22} /></h1>
          <p>내가 다녀온 모든 덕질의 기록과 여정을 한눈에 확인해요.</p>
        </div>
        <button className={styles.ghost} onClick={() => router.push('/chronicle')}>연대기 전체 보기 ›</button>
      </header>

      <div className={styles.stats}>
        <Stat icon="colorpin"   label="방문한 지역"   value={s?.areas.total}  unit="개" plus={s?.areas.thisMonth} loading={loading} />
        <Stat icon="colorshop"  label="방문한 샵"     value={s?.shops.total}  unit="곳" plus={s?.shops.thisMonth} loading={loading} />
        <Stat icon="colorevent" label="참여한 이벤트" value={s?.events.total} unit="개" plus={s?.events.thisMonth} loading={loading} />
        <Stat icon="colorroute" label="완주한 루트"   value={s?.routes.total} unit="개" plus={s?.routes.thisMonth} loading={loading} />
      </div>

      {/* ⭐ 주인공 — 지금 도전 중 */}
      <section className={styles.block}>
        <div className={styles.blockHead}>
          <h2>지금 도전 중</h2>
          {challenges.length > 0 && (
            <button className={styles.ghostSm} onClick={() => router.push('/growth')}>전체 보기 ›</button>
          )}
        </div>

        {loading ? (
          <div className={styles.heroSkel} />
        ) : !hero ? (
          <Empty
            text="모든 도전을 완료했어요. 새 목표가 곧 열려요."
            action="지도에서 샵 찾기"
            onAction={() => router.push('/map')}
          />
        ) : (
          <div className={styles.challengeGrid}>
            <HeroChallenge c={hero} onGo={() => router.push(hero.ctaHref)} />
            {subs.length > 0 && (
              <div className={styles.subs}>
                {subs.map(c => (
                  <SubChallenge key={c.tierId} c={c} onClick={() => router.push(c.ctaHref)} />
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* 최근의 덕질 기록 */}
      <section className={styles.block}>
        <div className={styles.blockHead}>
          <h2>최근의 덕질 기록</h2>
          <button className={styles.ghostSm} onClick={() => router.push('/chronicle')}>연대기 전체 보기 ›</button>
        </div>
        {loading ? <div className={styles.row}>{[0,1,2,3].map(i => <div key={i} className={styles.skelCard} />)}</div>
         : stories.length === 0 ? (
          <Empty text="샵 상세에서 “방문했어요”를 누르면 그날의 기록이 여기 쌓여요." action="지도에서 샵 찾기" onAction={() => router.push('/map')} />
        ) : (
          <div className={styles.row}>
            {stories.map(st => <StoryTile key={st.key} s={st} onClick={() => router.push('/chronicle')} />)}
          </div>
        )}
      </section>

      {/* 작품 탐험 현황 */}
      <section className={styles.block}>
        <div className={styles.blockHead}>
          <h2>좋아하는 작품 탐험 현황</h2>
          <button className={styles.ghostSm} onClick={() => router.push('/my-works')}>전체 보기 ›</button>
        </div>
        {loading ? <div className={styles.row}>{[0,1,2,3].map(i => <div key={i} className={styles.skelCard} />)}</div>
         : works.length === 0 ? (
          <Empty text="작품을 최애·관심으로 등록하면 탐험도가 쌓여요." action="작품 둘러보기" onAction={() => router.push('/my-works')} />
        ) : (
          <div className={styles.row}>
            {works.slice(0, 4).map(w => <WorkTile key={w.id} w={w} onClick={() => router.push(`/work/${w.slug}`)} />)}
          </div>
        )}
      </section>

      {/* 최근 해금한 배지 — 결과는 작게 */}
      {badges.length > 0 && (
        <section className={styles.blockSm}>
          <div className={styles.blockHead}>
            <h2>최근 해금한 배지</h2>
            <button className={styles.ghostSm} onClick={() => router.push('/growth')}>전체 보기 ›</button>
          </div>
          <div className={styles.badgeRow}>
            {badges.map(b => <BadgeChip key={b.id} b={b} />)}
          </div>
        </section>
      )}

      <section className={styles.cta}>
        <Taku pose="walk" size={104} />
        <div className={styles.ctaBody}>
          <h3>기록할수록 더 많은 추억이 쌓여요</h3>
          <p>오늘의 덕질도 타쿠로드에 기록해보세요.</p>
        </div>
        <button className={styles.ctaBtn} onClick={() => router.push('/map')}>새로운 기록 남기기</button>
      </section>
    </div>
  )
}

/* ── 지금 도전 중 ─────────────────────────────── */

function HeroChallenge({ c, onGo }: { c: Challenge; onGo: () => void }) {
  const remain = Math.max(0, c.target - c.done)
  return (
    <article className={styles.hero}>
      <div className={styles.heroTop}>
        <span className={styles.heroSeries}>{c.badgeName}</span>
        <span className={styles.heroStep}>
          {c.earnedCount} / {c.totalTiers} 단계
        </span>
      </div>

      <div className={styles.heroNum}>
        <strong>{c.done}</strong>
        <span>/ {c.target}</span>
      </div>

      <div className={styles.heroBar}><span style={{ width: `${c.pct}%` }} /></div>

      <p className={styles.heroLine}>
        <b>{c.verb} {remain}회</b>만 더 하면
      </p>

      <div className={styles.reward}>
        <Icon name="colorstar" size={17} />
        <span><b>{c.rewardName}</b> 해금</span>
      </div>

      <button className={styles.heroBtn} onClick={onGo}>{c.ctaLabel} ›</button>
    </article>
  )
}

function SubChallenge({ c, onClick }: { c: Challenge; onClick: () => void }) {
  return (
    <article className={styles.sub} onClick={onClick}>
      <div className={styles.subHead}>
        <span className={styles.subName}>{c.badgeName}</span>
        <span className={styles.subNum}>{c.done}<em>/{c.target}</em></span>
      </div>
      <div className={styles.subBar}><span style={{ width: `${c.pct}%` }} /></div>
      <div className={styles.subCta}>{c.ctaLabel} ›</div>
    </article>
  )
}

function BadgeChip({ b }: { b: EarnedBadge }) {
  return (
    <div className={`${styles.badgeChip} ${styles['r_' + (b.rarity ?? 'common')]}`}>
      {b.icon
        ? <img src={b.icon} alt="" />
        : <MaskIcon name="star" size={20} color="var(--accent)" />}
      <span>{b.name}</span>
    </div>
  )
}

/* ── 나머지 조각들 ────────────────────────────── */

function Stat({ icon, label, value, unit, plus, loading }: {
  icon: string; label: string; value?: number; unit: string; plus?: number; loading: boolean
}) {
  return (
    <div className={styles.stat}>
      <div className={styles.statIcon}><Icon name={icon} size={30} /></div>
      <div className={styles.statBody}>
        <div className={styles.statLabel}>{label}</div>
        <div className={styles.statValue}>{loading ? '—' : (value ?? 0)}<em>{unit}</em></div>
        <div className={styles.statSub}>
          이번 달 {typeof plus === 'number' && plus > 0
            ? <span className={styles.plus}>+{plus}</span>
            : <span className={styles.zero}>0</span>}
        </div>
      </div>
    </div>
  )
}

function StoryTile({ s, onClick }: { s: StoryCardSummary; onClick: () => void }) {
  return (
    <article className={styles.card} onClick={onClick}>
      <div className={styles.visual}>
        <span className={styles.dateBadge}>{fmtDate(s.date)}</span>
        {s.imageUrl
          ? <img src={s.imageUrl} alt="" />
          : <div className={styles.fallback}><span>{s.placeName ?? s.area}</span></div>}
      </div>
      <div className={styles.cardBody}>
        <div className={styles.cardArea}>
          <Icon name="colorpin" size={15} />
          {s.area}
        </div>
        <div className={styles.cardSpots}>
          {s.spots.join(' · ')}{s.moreCount > 0 ? ` · +${s.moreCount}` : ''}
        </div>
        {s.pct > 0 && (
          <>
            <div className={styles.pct}>탐험도 {s.pct}%</div>
            <div className={styles.bar}><span style={{ width: `${s.pct}%` }} /></div>
          </>
        )}
      </div>
    </article>
  )
}

function WorkTile({ w, onClick }: { w: WorkCollection; onClick: () => void }) {
  return (
    <article className={styles.workCard} onClick={onClick}>
      <div className={styles.workTop}>
        <div className={styles.workCover}>
          {w.coverUrl ? <img src={w.coverUrl} alt="" /> : <span>{w.name.slice(0, 2)}</span>}
        </div>
        <div className={styles.workHead}>
          <div className={styles.workName}>{w.name}</div>
          <div className={styles.workLabel}>종합 탐험도</div>
          <div className={styles.workPct}>{w.overall}<em>%</em></div>
        </div>
      </div>
      <div className={styles.workAxes}>
        {AXIS_KEYS.filter(k => w.axes[k].total > 0).map(k => (
          <span key={k} className={styles.axisChip}>
            {AXIS_LABEL[k]} {w.axes[k].done}/{w.axes[k].total}
          </span>
        ))}
      </div>
      {w.next && (
        <div className={styles.workNext}>
          <span className={styles.nextLabel}>다음 목표</span>
          <span className={styles.nextText}>
            {w.next.name} {AXIS_VERB[w.next.axis]} 시 <b>{w.next.after}</b>
          </span>
        </div>
      )}
      <div className={styles.bar}><span style={{ width: `${w.overall}%` }} /></div>
    </article>
  )
}

function Empty({ text, action, onAction }: { text: string; action?: string; onAction?: () => void }) {
  return (
    <div className={styles.empty}>
      <p>{text}</p>
      {action && <button onClick={onAction}>{action}</button>}
    </div>
  )
}
