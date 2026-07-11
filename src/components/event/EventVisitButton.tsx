'use client'

import { useEffect, useState } from 'react'
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

  useEffect(() => {
    if (user) getMyEventVisit(user.id, eventId).then(setVisited).catch(() => {})
    getEventVisitCount(eventId).then(setCount).catch(() => {})
  }, [user, eventId])

  const handleClick = async () => {
    if (!user) { router.push('/login'); return }
    if (visited || submitting) return

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
    </div>
  )
}
