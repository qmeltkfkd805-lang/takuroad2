'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { getCollectionHome, CollectionHome, StoryCardSummary, WorkCollection } from '@/services/collectionService'
import { AXIS_KEYS, AXIS_LABEL, AXIS_VERB } from '@/lib/work/workProgress'
import { Icon, Taku } from '@/components/tds'
import { MaskIcon } from './MaskIcon'
import { ROUTES } from '@/lib/constants/routes'
import styles from './CollectionHomePage.module.css'

/* 나의 덕질 컬렉션
   ⭐ 카드의 얼굴 = Place 대표 이미지. "어느 샵에 갔는가"가 아니라 "어디서 덕질했는가"
   ⭐ 진행률·다음목표는 정책(workProgress)이 계산해서 준 걸 그리기만 한다 */

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
  const stories = data?.stories ?? []
  const works = data?.works ?? []
  const badges = data?.badges ?? []

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <h1>나의 덕질 컬렉션 <Icon name="colorstar" size={22} /></h1>
          <p>내가 다녀온 모든 덕질의 기록과 여정을 한눈에 확인해요.</p>
        </div>
        <button className={styles.ghost} onClick={() => router.push('/chronicle')}>연대기 전체 보기 ›</button>
      </header>

      {/* 통계 4칸 — 실제로 기록된 것만 */}
      <div className={styles.stats}>
        <Stat icon="colorpin"   label="방문한 지역"   value={s?.areas.total}  unit="개" plus={s?.areas.thisMonth} loading={loading} />
        <Stat icon="colorshop"  label="방문한 샵"     value={s?.shops.total}  unit="곳" plus={s?.shops.thisMonth} loading={loading} />
        <Stat icon="colorevent" label="참여한 이벤트" value={s?.events.total} unit="개" plus={s?.events.thisMonth} loading={loading} />
        <Stat icon="colorroute" label="완주한 루트"   value={s?.routes.total} unit="개" plus={s?.routes.thisMonth} loading={loading} />
      </div>

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

      {/* 좋아하는 작품 탐험 현황 */}
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

      {/* 획득한 배지 */}
      <section className={styles.block}>
        <div className={styles.blockHead}>
          <h2>획득한 배지</h2>
          <button className={styles.ghostSm} onClick={() => router.push('/profile')}>전체 보기 ›</button>
        </div>
        {loading ? <div className={styles.row}>{[0,1,2].map(i => <div key={i} className={styles.skelBadge} />)}</div>
         : badges.length === 0 ? (
          <Empty text="기록을 쌓으면 배지가 하나씩 열려요." />
        ) : (
          <div className={styles.badges}>
            {badges.map(b => (
              <div key={b.id} className={styles.badge}>
                <div className={styles.badgeIcon}>
                  {b.iconUrl
                    ? <img src={b.iconUrl} alt="" />
                    : <MaskIcon name="star" size={34} color="var(--accent)" />}
                </div>
                <div className={styles.badgeName}>{b.name}</div>
                {b.condition && <div className={styles.badgeCond}>{b.condition}</div>}
              </div>
            ))}
            {(data?.badgeMore ?? 0) > 0 && (
              <div className={styles.badgeMore} onClick={() => router.push('/profile')}>
                <strong>+{data?.badgeMore}</strong>
                <span>더 많은 배지</span>
              </div>
            )}
          </div>
        )}
      </section>

      {/* CTA */}
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

/* ── 조각들 ─────────────────────────────────────── */

function Stat({ icon, label, value, unit, plus, loading }: {
  icon: string; label: string; value?: number; unit: string; plus?: number; loading: boolean
}) {
  return (
    <div className={styles.stat}>
      <div className={styles.statIcon}><Icon name={icon} size={30} /></div>
      <div className={styles.statBody}>
        <div className={styles.statLabel}>{label}</div>
        <div className={styles.statValue}>
          {loading ? '—' : (value ?? 0)}<em>{unit}</em>
        </div>
        <div className={styles.statSub}>
          이번 달 {typeof plus === 'number' && plus > 0
            ? <span className={styles.plus}>+{plus}</span>
            : <span className={styles.zero}>0</span>}
        </div>
      </div>
    </div>
  )
}

/* Story 타일 — 얼굴은 Place 이미지, 없으면 지역명 그라디언트 */
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

/* 작품 타일 — 종합 탐험도 + 다음 목표 (정책이 준 값) */
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
