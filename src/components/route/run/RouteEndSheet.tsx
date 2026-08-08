'use client'
/* 루트 종료 시트 — 자동으로 확인되지 않은 곳만 보여주고, 방문한 곳을 직접 체크(수동 기록)하게 한다.
   '전체 방문 처리' 버튼은 두지 않는다. 종료 방식: 완주 / 부분 기록 / 나중에 이어가기. */
import { useState } from 'react'
import styles from './RouteEndSheet.module.css'

export interface EndShop { id: string; name: string; floor?: string | null }

export default function RouteEndSheet(props: {
  shops: EndShop[]
  confirmedShopIds: Set<string>
  fieldVerifiedCount: number
  busy: boolean
  onEnd: (mode: 'complete' | 'partial' | 'later', manualShopIds: string[]) => void
  onClose: () => void
}) {
  const { shops, confirmedShopIds, fieldVerifiedCount, busy, onEnd, onClose } = props
  const unconfirmed = shops.filter(s => !confirmedShopIds.has(s.id))
  const confirmedCount = shops.length - unconfirmed.length
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [askHonest, setAskHonest] = useState(false)

  const toggle = (id: string) => setChecked(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n
  })
  const manualIds = [...checked]

  // 현장에서 자동 확인된 곳이 하나도 없으면 완주 전에 부드럽게 한 번 확인
  const onCompleteTap = () => {
    if (fieldVerifiedCount === 0) { setAskHonest(true); return }
    onEnd('complete', manualIds)
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" onClick={busy ? undefined : onClose}>
      <div className={styles.sheet} onClick={e => e.stopPropagation()}>
        <div className={styles.grip} />
        <h2 className={styles.title}>오늘 루트를 마칠까요?</h2>
        <p className={styles.summary}>
          현장에서 확인된 곳 <b>{confirmedCount}곳</b>
          {unconfirmed.length > 0 && <> · 아직 확인 안 된 곳 <b>{unconfirmed.length}곳</b></>}
        </p>

        {unconfirmed.length > 0 && (
          <>
            <p className={styles.hint}>방문했지만 자동으로 확인되지 않은 곳이 있다면 체크해 주세요.</p>
            <ul className={styles.list}>
              {unconfirmed.map(s => {
                const on = checked.has(s.id)
                return (
                  <li key={s.id}>
                    <button className={`${styles.item} ${on ? styles.itemOn : ''}`} onClick={() => toggle(s.id)} aria-pressed={on}>
                      <span className={`${styles.box} ${on ? styles.boxOn : ''}`}>{on ? '✓' : ''}</span>
                      <span className={styles.name}>{s.name}{s.floor ? <span className={styles.floor}>{s.floor}</span> : null}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
            <p className={styles.note}>직접 기록한 방문은 ‘현장 확인’ 보너스에는 포함되지 않아요.</p>
          </>
        )}

        {askHonest ? (
          <div className={styles.confirm}>
            <p className={styles.confirmMsg}>
              잠깐만요 🙂 현장에서 자동으로 확인된 곳이 아직 없어요.<br />
              실제로 다녀온 곳만 체크했다면 그대로 완주할게요. 혹시 안 가본 곳도 체크했다면 풀어주세요.
            </p>
            <div className={styles.actions}>
              <button className={styles.primary} disabled={busy} onClick={() => onEnd('complete', manualIds)}>
                {busy ? '처리 중…' : '실제로 다녀왔어요, 완주'}
              </button>
              <button className={styles.textBtn} disabled={busy} onClick={() => setAskHonest(false)}>다시 확인할게요</button>
            </div>
          </div>
        ) : (
          <div className={styles.actions}>
            <button className={styles.primary} disabled={busy} onClick={onCompleteTap}>
              {busy ? '처리 중…' : '루트 완주로 마치기'}
            </button>
            <button className={styles.secondary} disabled={busy} onClick={() => onEnd('partial', manualIds)}>
              부분 기록만 하고 종료
            </button>
            <button className={styles.textBtn} disabled={busy} onClick={() => onEnd('later', [])}>
              나중에 이어가기
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
