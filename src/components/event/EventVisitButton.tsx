'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { recordEventVisit, getMyEventVisit, getEventVisitCount } from '@/services/eventVisitService'
import { EventIcon } from './EventIcon'
import styles from './EventVisitButton.module.css'

interface Props {
  eventId: string
  eventTitle: string
  /** 종료된 이벤트 — 그래도 기록은 남길 수 있다 */
  ended: boolean
}

/**
 * "다녀왔어요" — 이벤트판 방문 기록 버튼.
 * 샵의 CheckInButton과 같은 역할이자, 이벤트 Activity의 시작점.
 *
 * ⭐ 종료 여부와 상관없이 항상 누를 수 있다.
 *    연대기의 목적은 "지금 진행 중인 걸 인증"이 아니라 "그때 갔던 기억"이니까.
 */
export default function EventVisitButton({ eventId, eventTitle, ended }: Props) {
  const { user } = useAuth()
  const router = useRouter()

  const [visited, setVisited] = useState(false)
  const [count, setCount] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  // 확인 창이 열려 있을 때 Esc 로 닫기
  useEffect(() => {
    if (!confirmOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setConfirmOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirmOpen])

  useEffect(() => {
    if (user) getMyEventVisit(user.id, eventId).then(setVisited).catch(() => {})
    getEventVisitCount(eventId).then(setCount).catch(() => {})
  }, [user, eventId])

  // 버튼은 바로 기록하지 않고 확인 창부터 연다(잘못 누름 방지)
  const handleClick = () => {
    if (!user) { router.push('/login'); return }
    if (visited || submitting) return
    setConfirmOpen(true)
  }

  const confirmVisit = async () => {
    if (!user || visited || submitting) return
    setConfirmOpen(false)
    setSubmitting(true)
    const res = await recordEventVisit(user.id, eventId, 'button')

    if (res.success) {
      setVisited(true)
      if (!res.already) setCount(c => c + 1)
      setToast(res.already ? '이미 기록된 이벤트예요' : '기록했어요! 연대기에 남았습니다')
      setTimeout(() => setToast(null), 2600)
    } else {
      setToast(res.error ?? '기록에 실패했어요')
      setTimeout(() => setToast(null), 2600)
    }
    setSubmitting(false)
  }

  return (
    <div className={styles.wrap}>
      <button
        className={`${styles.btn} ${visited ? styles.done : ''}`}
        onClick={handleClick}
        disabled={submitting || visited}
        title={visited ? `${eventTitle} — 이미 기록했어요` : `${eventTitle} 다녀왔어요`}
      >
        <EventIcon name={visited ? 'sparkle' : 'pin'} size={16} />
        {submitting ? '기록 중…' : visited ? '다녀온 이벤트예요' : '다녀왔어요'}
      </button>

      {count > 0 && (
        <span className={styles.count}>{count}명이 다녀갔어요</span>
      )}

      {/* 종료된 이벤트 — 기록을 막지 않고, 왜 아직 누를 수 있는지 알려준다 */}
      {ended && !visited && (
        <p className={styles.endedHint}>
          종료된 이벤트입니다. 그래도 다녀오셨다면 기록을 남길 수 있어요.
        </p>
      )}

      {toast && <div className={styles.toast}>{toast}</div>}

      {/* 확인 창 — 히어로가 overflow:hidden·filter 를 써서 안에 두면 잘리므로 body 로 띄운다 */}
      {confirmOpen && typeof document !== 'undefined' && createPortal(
        <div className={styles.backdrop} onClick={() => setConfirmOpen(false)}>
          <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="ev-visit-title" onClick={e => e.stopPropagation()}>
            <div className={styles.modalIcon}><EventIcon name="pin" size={24} color="var(--accent)" /></div>
            <h3 id="ev-visit-title" className={styles.modalTitle}>이 이벤트에 다녀오셨나요?</h3>
            <p className={styles.modalEvent}>{eventTitle}</p>
            <p className={styles.modalDesc}>다녀온 이벤트로 기록하면 내 연대기에 남아요.</p>
            <div className={styles.modalActions}>
              <button type="button" className={styles.modalCancel} onClick={() => setConfirmOpen(false)}>취소</button>
              <button type="button" className={styles.modalOk} onClick={confirmVisit} autoFocus>네, 다녀왔어요</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
