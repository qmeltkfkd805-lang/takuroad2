'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { getGrowthCenter, GrowthCenter, CosmeticProgress } from '@/services/growthCenterService'
import { Challenge, EarnedBadge, GrowthSeries } from '@/services/growthService'
import { RARITY_LABEL, fxClass, bgStyle, FRAME_STYLE } from '@/lib/cosmetics/style'
import { Icon, Taku } from '@/components/tds'
import { MaskIcon } from '@/components/collection/MaskIcon'
import { ROUTES } from '@/lib/constants/routes'
import styles from './GrowthPage.module.css'

/* 성장 센터 — 덕질은 끝이 없습니다

   ⭐ 주인공은 배지가 아니라 "다음 목표"다.
   ⭐ "이번 보상 미리보기"가 핵심 — 뭘 주는지 크게 봐야 갖고 싶어진다.
      "17/20"은 그냥 숫자다. 그 옆에 프레임이 있어야 움직인다.
   ⭐ LV/XP는 안 넣는다 (사이드바에 이미 항상 보인다).
   ⭐ 커뮤니티 카테고리는 없다 (덕질 활동이 정체성). */

const TYPE_LABEL: Record<string, string> = {
  frame: '프로필 프레임', background: '프로필 배경',
  title: '칭호', effect: '프로필 효과', theme: '프로필 테마',
}

export default function GrowthPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [d, setD] = useState<GrowthCenter | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    getGrowthCenter(user.id).then(setD).catch(() => {}).finally(() => setLoading(false))
  }, [user])

  if (!user) {
    return (
      <div className={styles.page}>
        <div className={styles.signin}>
          <h1>나의 성장</h1>
          <p>로그인하면 도전 중인 목표가 보여요.</p>
          <button onClick={() => router.push(ROUTES.login)}>로그인하기</button>
        </div>
      </div>
    )
  }

  const challenges = d?.challenges ?? []
  const masters = (d?.series ?? []).filter(s => s.complete)
  const top = challenges[0]

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <h1>성장 센터 <Icon name="colorstar" size={22} /></h1>
          <p>덕질은 끝이 없습니다. 다음 목표를 달성하고 새로운 꾸미기 요소를 해금해보세요.</p>
        </div>
        {d && d.totalSteps > 0 && (
          <div className={styles.total}>
            <b>{d.totalEarned}</b> / {d.totalSteps} 단계 해금
          </div>
        )}
      </header>

      <div className={styles.layout}>
        {/* ═══ 왼쪽 — 도전 ═══ */}
        <div className={styles.main}>
          {masters.length > 0 && (
            <section className={styles.block}>
              <div className={styles.blockHead}>
                <h2><Icon name="colorstar" size={17} /> 마스터</h2>
              </div>
              <div className={styles.masterGrid}>
                {masters.map(m => <MasterCard key={m.badgeId} m={m} />)}
              </div>
            </section>
          )}
          <section className={styles.block}>
            <div className={styles.blockHead}>
              <h2><Icon name="colorstar" size={17} /> 지금 도전 중</h2>
            </div>

            {loading ? (
              <div className={styles.cards}>{[0,1,2].map(i => <div key={i} className={styles.skelCard} />)}</div>
            ) : challenges.length === 0 ? (
              <div className={styles.empty}>
                <Taku pose="sit" size={92} />
                <p>모든 도전을 완료했어요. 새 목표가 곧 열려요.</p>
              </div>
            ) : (
              <div className={styles.cards}>
                {challenges.slice(0, 3).map(c => (
                  <ChallengeCard key={c.tierId} c={c} onGo={() => router.push(c.ctaHref)} />
                ))}
              </div>
            )}
          </section>

          <div className={styles.two}>
            {/* 최근 해금 */}
            <section className={styles.block}>
              <div className={styles.blockHead}>
                <h2>최근 해금</h2>
                <button className={styles.ghostSm} onClick={() => router.push('/cosmetic')}>전체 보기 ›</button>
              </div>
              {loading ? (
                <div className={styles.badgeRow}>{[0,1,2].map(i => <div key={i} className={styles.skelBadge} />)}</div>
              ) : (d?.recent.length ?? 0) === 0 ? (
                <p className={styles.dim}>아직 해금한 배지가 없어요.</p>
              ) : (
                <div className={styles.badgeRow}>
                  {d!.recent.slice(0, 4).map(b => <BadgeTile key={b.id} b={b} />)}
                </div>
              )}
            </section>

            {/* 이번 보상 미리보기 — 뭘 주는지 크게 */}
            <section className={styles.block}>
              <div className={styles.blockHead}>
                <h2>이번 보상 미리보기</h2>
              </div>
              {loading ? (
                <div className={styles.skelPreview} />
              ) : !d?.nextReward ? (
                <p className={styles.dim}>도전을 시작하면 보상이 보여요.</p>
              ) : (
                <div className={styles.preview}>
                  <div
                    className={[
                      styles.previewBox,
                      d.nextReward.cosmetic.type === 'effect'
                        ? 'tkfx-preview ' + fxClass(d.nextReward.cosmetic.slug) + ' ' + styles.previewDark
                        : '',
                    ].join(' ')}
                    style={d.nextReward.cosmetic.type === 'background'
                      ? bgStyle(d.nextReward.cosmetic.slug, (d.nextReward.cosmetic as any).assetUrl)
                      : undefined}
                  >
                    {d.nextReward.cosmetic.type === 'title' && (
                      <span className={styles.previewTitle}>{d.nextReward.cosmetic.name}</span>
                    )}
                    {d.nextReward.cosmetic.type === 'frame' && (
                      <span className={styles.previewFace} style={FRAME_STYLE[d.nextReward.cosmetic.slug]} />
                    )}
                  </div>
                  <div className={styles.previewBody}>
                    <div className={styles.previewType}>{TYPE_LABEL[d.nextReward.cosmetic.type]}</div>
                    <div className={styles.previewName}>{d.nextReward.cosmetic.name}</div>
                    <p className={styles.previewCond}>
                      <b>{d.nextReward.tierName}</b> 달성 시 해금
                    </p>
                    {top && (
                      <div className={styles.previewBar}>
                        <span style={{ width: `${top.pct}%` }} />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* 업적 카테고리 */}
          <section className={styles.block}>
            <div className={styles.blockHead}><h2>업적 카테고리</h2></div>
            {loading ? (
              <div className={styles.catRow}>{[0,1,2,3].map(i => <div key={i} className={styles.skelCat} />)}</div>
            ) : (
              <div className={styles.catRow}>
                {(d?.series ?? []).map(s => <CatTile key={s.badgeId} s={s} />)}
              </div>
            )}
          </section>
        </div>

        {/* ═══ 오른쪽 ═══ */}
        <aside className={styles.side}>
          {/* 오늘의 추천 도전 */}
          {top && (
            <section className={styles.rec}>
              <div className={styles.recHead}>오늘의 추천 도전</div>
              <p className={styles.recLine}>
                {top.verb} <b>{Math.max(0, top.target - top.done)}회</b>만 더 하면
              </p>
              <p className={styles.recGoal}>{top.rewardName} 달성!</p>
              <div className={styles.recTaku}><Taku pose="walk" size={96} /></div>
              <button className={styles.recBtn} onClick={() => router.push(top.ctaHref)}>
                {top.ctaLabel} ›
              </button>
            </section>
          )}

          {/* 꾸미기 보상 */}
          <section className={styles.block}>
            <div className={styles.blockHead}>
              <h2>꾸미기 보상</h2>
              <button className={styles.ghostSm} onClick={() => router.push('/cosmetic')}>전체 보기 ›</button>
            </div>
            {loading ? (
              <div className={styles.cosList}>{[0,1,2,3].map(i => <div key={i} className={styles.skelRow} />)}</div>
            ) : (
              <div className={styles.cosList}>
                {(d?.cosmetics ?? []).map(c => <CosRow key={c.type} c={c} onClick={() => router.push('/cosmetic')} />)}
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}

/* ── 조각들 ─────────────────────────────── */

function MasterCard({ m }: { m: GrowthSeries }) {
  const finalName = m.steps[m.steps.length - 1]?.name ?? m.badgeName
  return (
    <article className={styles.masterCard}>
      <div className={styles.masterTop}>
        <div className={styles.masterIcon}>
          {m.icon ? <img src={m.icon} alt="" /> : <MaskIcon name="star" size={24} color="var(--accent)" />}
        </div>
        <div className={styles.masterName}>{finalName}</div>
      </div>
      <div className={styles.masterNum}>
        <strong>{m.done}</strong><span>{m.verb}</span>
      </div>
    </article>
  )
}

function ChallengeCard({ c, onGo }: { c: Challenge; onGo: () => void }) {
  const remain = Math.max(0, c.target - c.done)
  return (
    <article className={styles.card} onClick={onGo}>
      <div className={styles.cardTop}>
        <div className={styles.cardIcon}>
          {c.tierIcon
            ? <img src={c.tierIcon} alt="" />
            : <MaskIcon name="star" size={22} color="var(--accent)" />}
        </div>
        <div className={styles.cardName}>{c.badgeName}</div>
      </div>

      <div className={styles.cardNum}>
        <strong>{c.done}</strong><span>/ {c.target}</span>
      </div>
      <div className={styles.cardBar}><span style={{ width: `${c.pct}%` }} /></div>

      <p className={styles.cardLine}>{c.verb} <b>{remain}회</b>만 더</p>

      <div className={styles.cardReward}>
        <span className={styles.cardRewardLabel}>보상</span>
        <span className={styles.cardRewardName}>{c.rewardName}</span>
      </div>
    </article>
  )
}

function BadgeTile({ b }: { b: EarnedBadge }) {
  return (
    <div className={`${styles.badge} ${styles['r_' + (b.rarity ?? 'common')]}`}>
      <div className={styles.badgeIcon}>
        {b.icon ? <img src={b.icon} alt="" /> : <MaskIcon name="star" size={20} color="var(--accent)" />}
      </div>
      <div className={styles.badgeName}>{b.name}</div>
      <div className={styles.badgeDate}>{b.earnedAt.slice(0, 10).replace(/-/g, '.')}</div>
    </div>
  )
}

function CatTile({ s }: { s: GrowthSeries }) {
  const cur = s.steps.find(st => st.current)
  const target = cur?.target ?? 0
  const level = s.complete ? s.steps.length : s.earnedCount + 1
  const pct = s.complete ? 100 : (target ? Math.min(100, Math.round((s.done / target) * 100)) : 0)
  return (
    <div className={styles.cat} title={s.hint}>
      <div className={styles.catIcon}>
        {s.icon ? <img src={s.icon} alt="" /> : <MaskIcon name="star" size={20} color="var(--accent)" />}
      </div>
      <div className={styles.catBody}>
        <div className={styles.catName}>{s.badgeName} Lv.{level}</div>
        <div className={styles.catNum}>{s.complete ? '완료' : s.done + '/' + target}</div>
      </div>
      <div className={styles.catBar}><span style={{ width: `${pct}%` }} /></div>
    </div>
  )
}

function CosRow({ c, onClick }: { c: CosmeticProgress; onClick: () => void }) {
  const pct = c.total ? Math.round((c.got / c.total) * 100) : 0
  return (
    <button className={styles.cosRow} onClick={onClick}>
      <span className={styles.cosName}>{c.label}</span>
      <span className={styles.cosBar}><span style={{ width: `${pct}%` }} /></span>
      <span className={styles.cosNum}><b>{c.got}</b>/{c.total}</span>
    </button>
  )
}
