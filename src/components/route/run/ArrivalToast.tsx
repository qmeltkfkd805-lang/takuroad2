'use client'
/* 자동 도착 확인 토스트 — 확인된 체크포인트를 알리고 되돌리기(undo) 제공.
   자동 판정이 틀렸을 때 사용자가 즉시 취소할 수 있게 한다. */
import { useEffect } from 'react'
import type { Arrival } from '@/lib/routeRun/useRouteRun'
import styles from './ArrivalToast.module.css'

function ToastItem({ item, onUndo, onDismiss }: { item: Arrival; onUndo: (key: string) => void; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(item.id), 6000)
    return () => clearTimeout(t)
  }, [item.id, onDismiss])
  return (
    <div className={styles.toast} role="status">
      <div className={styles.body}>
        <span className={styles.check}>✓</span>
        <div className={styles.text}>
          <b>{item.label}</b> 도착을 확인했어요
          <span className={styles.sub}>현장에서 확인된 방문</span>
        </div>
      </div>
      <button className={styles.undo} onClick={() => { onUndo(item.key); onDismiss(item.id) }}>되돌리기</button>
    </div>
  )
}

export default function ArrivalToast({ arrivals, onUndo, onDismiss }: {
  arrivals: Arrival[]
  onUndo: (key: string) => void
  onDismiss: (id: string) => void
}) {
  if (!arrivals.length) return null
  return (
    <div className={styles.stack}>
      {arrivals.slice(-3).map(a => <ToastItem key={a.id} item={a} onUndo={onUndo} onDismiss={onDismiss} />)}
    </div>
  )
}
