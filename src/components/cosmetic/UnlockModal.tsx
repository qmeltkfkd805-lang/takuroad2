'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { UNLOCK_EVENT, UnlockPayload, UnlockedTier, loadUnlock } from '@/services/unlockService'
import { equipCosmetic } from '@/services/cosmeticService'
import { previewStyle, RARITY_LABEL, fxClass } from '@/lib/cosmetics/style'
import { Icon, Taku } from '@/components/tds'
import { AXIS_VERB } from '@/lib/work/workProgress'
import styles from './UnlockModal.module.css'

/* 해금 모달 — "보상을 받는 경험"

   ⭐ 배지가 아니라 코스메틱이 주인공이다. 크게 보여준다.
   ⭐ 우선순위: 축하 → 새로 열린 것(가장 크게) → 바로 착용 → 다음 목표
   ⭐ 하단의 "다음 목표"가 핵심이다.
      획득의 기쁨이 최고조일 때 다음 문을 열어준다 — "좋아, 하나만 더 해볼까?"
   ⭐ 여러 개를 동시에 딸 수 있다 (리뷰 10개 + 탐험가 Lv2). 그것도 지원한다. */

const TYPE_LABEL: Record<string, string> = {
  frame: '프로필 프레임',
  background: '프로필 배경',
  title: '칭호',
  effect: '프로필 효과',
  theme: '프로필 테마',
}

export default function UnlockModal() {
  const { user } = useAuth()
  const router = useRouter()
  const [data, setData] = useState<UnlockPayload | null>(null)
  const [equipping, setEquipping] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!user) return
    const onUnlock = async (e: Event) => {
      const ids = (e as CustomEvent<string[]>).detail
      if (!ids?.length) return
      try {
        const payload = await loadUnlock(user.id, ids)
        if (payload.tiers.length > 0) { setData(payload); setDone(false) }
      } catch {}
    }
    window.addEventListener(UNLOCK_EVENT, onUnlock)
    return () => window.removeEventListener(UNLOCK_EVENT, onUnlock)
  }, [user])

  if (!data || !user) return null

  const rewards = data.tiers.filter(t => t.cosmetic)
  const multi = rewards.length > 1
  const close = () => setData(null)

  async function equipAll() {
    if (!user) return
    setEquipping(true)
    for (const t of rewards) {
      if (t.cosmetic) await equipCosmetic(user.id, t.cosmetic.type, t.cosmetic.id)
    }
    setEquipping(false)
    setDone(true)
    // 앱 전체(탑바·사이드바)에 반영되게
    setTimeout(() => window.location.reload(), 900)
  }

  return (
    <div className={styles.backdrop} onClick={close}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <button className={styles.x} onClick={close} aria-label="닫기">×</button>

        {/* 1. 축하 */}
        <div className={styles.top}>
          <Taku pose="gacha" size={72} />
          <h2>축하합니다!</h2>
          <p className={styles.achieve}>
            {multi
              ? <><b>{data.tiers.length}개</b>의 목표를 동시에 달성했어요</>
              : <><b>{data.tiers[0].tierName}</b> 달성!</>}
          </p>
        </div>

        {/* 2. 새로 열린 것 — 가장 크게 */}
        {rewards.length > 0 ? (
          <div className={styles.rewards}>
            <div className={styles.rewardHead}>
              <Icon name="colorstar" size={16} />
              새로운 보상 {multi ? rewards.length + '개가' : '이'} 해금되었습니다
            </div>

            <div className={multi ? styles.grid : styles.solo}>
              {rewards.map(t => <RewardCard key={t.tierId} t={t} big={!multi} />)}
            </div>
          </div>
        ) : (
          <div className={styles.rewards}>
            <div className={styles.solo}>
              {data.tiers[0].iconUrl
                ? <img src={data.tiers[0].iconUrl} alt="" width={120} height={120} />
                : <Icon name="colorstar" size={72} />}
            </div>
            <div className={styles.noReward}>{data.tiers[0].tierName} 배지를 획득했어요</div>
          </div>
        )}

        {/* 3. 바로 착용 */}
        {rewards.length > 0 && (
          <div className={styles.actions}>
            {done ? (
              <div className={styles.doneMsg}>착용했어요. 적용하는 중…</div>
            ) : (
              <>
                <button className={styles.primary} onClick={equipAll} disabled={equipping}>
                  {equipping ? '착용하는 중…' : (multi ? '모두 착용하기' : '지금 착용하기')}
                </button>
                <button className={styles.ghost} onClick={() => { close(); router.push('/cosmetic') }}>
                  {multi ? '하나씩 보기' : '나중에'}
                </button>
              </>
            )}
          </div>
        )}

        {/* 4. 다음 목표 — 기쁨에서 끝내지 않는다 */}
        {data.next && (
          <button
            className={styles.next}
            onClick={() => { close(); router.push(data.next!.ctaHref) }}
          >
            <span className={styles.nextLabel}>다음 목표</span>
            <span className={styles.nextText}>
              <b>{data.next.verb} {Math.max(0, data.next.target - data.next.done)}회</b>만 더 하면
              {' '}{data.next.rewardName}
            </span>
            <span className={styles.nextArrow}>›</span>
          </button>
        )}
      </div>
    </div>
  )
}

function RewardCard({ t, big }: { t: UnlockedTier; big: boolean }) {
  const c = t.cosmetic!
  const fx = c.type === 'effect' ? fxClass(c.slug) : ''

  return (
    <div className={`${styles.reward} ${big ? styles.rewardBig : ''}`}>
      <div
        className={`${styles.preview} ${fx ? styles[fx] : ''}`}
        style={previewStyle(c.type, c.slug)}
      >
        {c.type === 'title' && <span className={styles.previewTitle}>{c.name}</span>}
        {c.type === 'effect' && <span className={styles.previewFx} />}
        {c.type === 'frame' && <span className={styles.previewFace} />}
      </div>

      <div className={styles.rewardType}>{TYPE_LABEL[c.type] ?? c.type}</div>
      <div className={styles.rewardName}>{c.name}</div>
      <span className={`${styles.rarity} ${styles['r_' + c.rarity]}`}>
        {RARITY_LABEL[c.rarity] ?? c.rarity}
      </span>
    </div>
  )
}
