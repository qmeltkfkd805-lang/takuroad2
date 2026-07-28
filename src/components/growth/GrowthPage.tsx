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
import { XP_RULES, REASON_LABEL } from '@/services/expService'
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
  const [xpHelp, setXpHelp] = useState(false)

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

      {/* ═══ 성장 요약 — 레벨/XP · 오늘/이번주/총 · 일일목표 · 최근 레벨업 ═══ */}
      {d?.summary && (() => {
        const sm = d.summary
        const lv = sm.level
        const span = (lv.nextLevelThreshold ?? lv.currentLevelExp) - lv.currentLevelExp
        const lvPct = span > 0 ? Math.min(100, Math.round(((lv.totalExp - lv.currentLevelExp) / span) * 100)) : 100
        const goalPct = Math.min(100, Math.round((sm.goalCurrent / sm.goal) * 100))
        const tiles: [string, number, boolean][] = [['오늘', sm.today, true], ['이번 주', sm.week, true], ['총 XP', sm.total, false]]
        const xpHelpList: { label: string; xp: string }[] = [
          ...Object.entries(XP_RULES)
            .filter(([, r]) => r.baseXp > 0 && r.visible)
            .map(([k, r]) => ({ label: REASON_LABEL[k] ?? k, xp: String(r.baseXp) })),
          { label: '작품 정주행', xp: '10~50' },
          { label: '배지 획득', xp: '15~120' },
        ]
        return (
          <section style={{ position: 'relative', border: '1px solid var(--border)', borderRadius: 16, background: 'var(--surface)', padding: '18px 20px', marginBottom: 18 }}>
            {/* 경험치 얻는 방법 ? */}
            <div style={{ position: 'absolute', top: 14, right: 16 }}>
              <button onClick={() => setXpHelp(v => !v)} aria-label="경험치 얻는 방법"
                style={{ width: 22, height: 22, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--muted)', fontSize: 12, fontWeight: 900, cursor: 'pointer', lineHeight: 1, fontFamily: 'inherit' }}>?</button>
              {xpHelp && (
                <>
                  <div onClick={() => setXpHelp(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                  <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 50, width: 220, padding: '12px 14px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 10px 30px rgba(0,0,0,.14)' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 900, marginBottom: 8 }}>경험치 얻는 방법</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {xpHelpList.map((h, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)' }}>
                          <span>{h.label}</span><b style={{ color: 'var(--accent)' }}>+{h.xp}</b>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8, lineHeight: 1.5 }}>배지를 달성하면 더 큰 보너스 XP를 받아요.</div>
                  </div>
                </>
              )}
            </div>

            {/* 레벨 + XP */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <b style={{ fontSize: 20, fontWeight: 900 }}>LV.{lv.level}</b>
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent)' }}>{lv.title}</span>
            </div>
            <div style={{ height: 9, borderRadius: 9999, background: 'var(--surface2)', overflow: 'hidden', marginTop: 8 }}>
              <div style={{ height: '100%', width: `${lvPct}%`, background: 'linear-gradient(90deg,#FFC64B,#FF8A3D)' }} />
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 5 }}>
              {lv.nextLevelExp != null ? `다음 레벨까지 ${lv.nextLevelExp.toLocaleString()} XP` : '최고 레벨'}
            </div>

            {/* 다음 레벨 보상 — 보상을 크게 보여줘야 갖고 싶어진다 (설계 §8) */}
            {d.nextLevelReward && (() => {
              const r = d.nextLevelReward.reward
              const rlv = d.nextLevelReward.level
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14, padding: '12px 14px', borderRadius: 14, border: '1px solid #F1D48A', background: 'linear-gradient(135deg, rgba(255,224,138,.20), rgba(255,198,75,.05))' }}>
                  <div
                    className={r.type === 'effect' ? 'tkfx-preview ' + fxClass(r.slug) : undefined}
                    style={{ position: 'relative', width: 62, height: 62, borderRadius: 12, overflow: 'hidden', flexShrink: 0, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      ...(r.type === 'background' ? bgStyle(r.slug, r.assetUrl) : { background: r.type === 'effect' ? '#161b2e' : 'var(--surface2)' }) }}
                  >
                    {r.type === 'frame' && <span style={{ width: 34, height: 34, borderRadius: '50%', background: '#fff', ...(FRAME_STYLE[r.slug] || {}) }} />}
                    {r.type === 'title' && <span style={{ fontSize: 22 }}>🏷️</span>}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 900, color: '#C98A00' }}>🎁 다음 레벨 보상</div>
                    <div style={{ fontSize: 16, fontWeight: 900, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}><b style={{ color: 'var(--text)' }}>LV.{rlv}</b> 달성 시 해금 · {RARITY_LABEL[r.rarity] ?? r.rarity}</div>
                  </div>
                </div>
              )
            })()}

            {/* 오늘 / 이번주 / 총 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginTop: 16 }}>
              {tiles.map(([label, val, plus], i) => (
                <div key={i} style={{ background: 'var(--surface2)', borderRadius: 12, padding: '12px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 700 }}>{label}</div>
                  <div style={{ fontSize: 17, fontWeight: 900, marginTop: 3 }}>{plus ? '+' : ''}{val.toLocaleString()}</div>
                </div>
              ))}
            </div>

            {/* 일일 목표 */}
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 6 }}>
                <span style={{ fontWeight: 800 }}>오늘 목표{sm.goalDone && <span style={{ color: 'var(--accent)' }}> · 달성! +5</span>}</span>
                <span style={{ color: 'var(--muted)' }}>{sm.goalCurrent} / {sm.goal} XP</span>
              </div>
              <div style={{ height: 9, borderRadius: 9999, background: 'var(--surface2)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${goalPct}%`, background: sm.goalDone ? 'linear-gradient(90deg,#38C172,#2FA360)' : 'var(--accent)' }} />
              </div>
            </div>

            {/* 일일 미션 */}
            {sm.quests && sm.quests.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 800, marginBottom: 8 }}>일일 미션</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
                  {sm.quests.map((q, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, background: 'var(--surface2)' }}>
                      <span style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: q.done ? 'var(--accent)' : 'transparent', border: q.done ? 'none' : '1.5px solid var(--border)' }}>
                        {q.done && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5L20 6" /></svg>}
                      </span>
                      <span style={{ flex: 1, fontSize: 12.5, fontWeight: 700, color: q.done ? 'var(--text)' : 'var(--muted)' }}>{q.label}</span>
                      <b style={{ fontSize: 12, color: q.done ? 'var(--muted)' : 'var(--accent)' }}>+{q.xp}</b>
                    </div>
                  ))}
                </div>
                {/* 올클리어 보너스 */}
                {sm.questAll && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, padding: '10px 12px', borderRadius: 10, border: `1px solid ${sm.questAll.done ? '#F1D48A' : 'var(--border)'}`, background: sm.questAll.done ? 'linear-gradient(135deg, rgba(255,224,138,.20), rgba(255,198,75,.06))' : 'var(--surface)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={sm.questAll.done ? '#D69A00' : 'var(--muted)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" /></svg>
                    <span style={{ flex: 1, fontSize: 12.5, fontWeight: 800, color: 'var(--text)' }}>미션 전부 완료{sm.questAll.done && ' · 달성!'}</span>
                    <b style={{ fontSize: 12.5, color: sm.questAll.done ? '#C98A00' : 'var(--accent)' }}>+{sm.questAll.xp}</b>
                  </div>
                )}
              </div>
            )}

            {/* 최근 레벨업 */}
            {sm.recentLevelUps.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 800, marginBottom: 7 }}>최근 레벨업</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {sm.recentLevelUps.map((r, i) => (
                    <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 9999, background: 'var(--surface2)', fontSize: 12, fontWeight: 700 }}>
                      LV.{r.level}<span style={{ color: 'var(--muted)', fontWeight: 600 }}>{r.at?.slice(0, 10).replace(/-/g, '.')}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* XP 내역 진입 */}
            <div style={{ marginTop: 14, textAlign: 'right' }}>
              <button onClick={() => router.push('/xp')} style={{ border: 'none', background: 'none', color: 'var(--accent)', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>XP 내역 전체 보기 ›</button>
            </div>
          </section>
        )
      })()}

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
    <div className={`${styles.badge} ${styles['r_' + (b.rarity ?? 'common')]}`} title={b.earnedAt ? '획득: ' + b.earnedAt.slice(0, 10).replace(/-/g, '.') : undefined}>
      <div className={styles.badgeIcon}>
        {b.icon ? <img src={b.icon} alt="" /> : <MaskIcon name="star" size={20} color="var(--accent)" />}
      </div>
      <div className={styles.badgeName}>{b.name}</div>
    </div>
  )
}

function CatTile({ s }: { s: GrowthSeries }) {
  const [hover, setHover] = useState(false)
  const cur = s.steps.find(st => st.current)
  const target = cur?.target ?? 0
  const level = s.complete ? s.steps.length : s.earnedCount + 1
  const pct = s.complete ? 100 : (target ? Math.min(100, Math.round((s.done / target) * 100)) : 0)
  return (
    <div className={styles.cat} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      {hover && s.hint && <div className={styles.catTip}>{s.hint}</div>}
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