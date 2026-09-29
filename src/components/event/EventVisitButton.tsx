'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { recordEventVisit, getMyEventVisit, getEventVisitCount } from '@/services/eventVisitService'
import { getMyVisitPhotoCount, uploadVisitPhotos, MAX_VISIT_PHOTOS } from '@/services/eventVisitPhotoService'
import { EventIcon } from './EventIcon'
import styles from './EventVisitButton.module.css'

interface Props {
  eventId: string
  eventTitle: string
  /** 종료된 이벤트 — 그래도 기록은 남길 수 있다 */
  ended: boolean
}

type Step = 'confirm' | 'photo' | null
interface Picked { file: File; url: string }

/**
 * "다녀왔어요" — 이벤트판 방문 기록 버튼.
 * 샵의 CheckInButton과 같은 역할이자, 이벤트 Activity의 시작점.
 *
 * 흐름: 버튼 → 확인 창("다녀오셨나요?") → 기록 → 사진 단계(특전·음식 사진, 선택·최대 3장)
 *       사진은 연대기의 그 이벤트 아래에 함께 보이고, 내 공개 프로필 > 방문 기록에도 공개된다.
 *       이미 다녀온 이벤트는 "+ 사진 남기기"로 나중에 추가할 수 있다.
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
  const [step, setStep] = useState<Step>(null)
  const [justRecorded, setJustRecorded] = useState(false)   // 방금 기록하고 사진 단계로 온 경우

  // 사진
  const [photoCount, setPhotoCount] = useState(0)
  const [picked, setPicked] = useState<Picked[]>([])
  const [uploading, setUploading] = useState(false)
  const cameraRef = useRef<HTMLInputElement>(null)
  const albumRef = useRef<HTMLInputElement>(null)
  const room = Math.max(0, MAX_VISIT_PHOTOS - photoCount)

  function flash(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2600)
  }

  useEffect(() => {
    if (user) {
      getMyEventVisit(user.id, eventId).then(setVisited).catch(() => {})
      getMyVisitPhotoCount(user.id, eventId).then(setPhotoCount).catch(() => {})
    }
    getEventVisitCount(eventId).then(setCount).catch(() => {})
  }, [user, eventId])

  // 창이 열려 있을 때 Esc 로 닫기 (올리는 중엔 막음)
  useEffect(() => {
    if (!step) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !uploading) closeModal() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function clearPicked() {
    picked.forEach(p => URL.revokeObjectURL(p.url))
    setPicked([])
  }
  function closeModal() {
    if (uploading) return
    clearPicked()
    setStep(null)
  }

  // 버튼은 바로 기록하지 않고 확인 창부터 연다(잘못 누름 방지)
  const handleClick = () => {
    if (!user) { router.push('/login'); return }
    if (visited || submitting) return
    setStep('confirm')
  }

  const confirmVisit = async () => {
    if (!user || visited || submitting) return
    setSubmitting(true)
    const res = await recordEventVisit(user.id, eventId, 'button')
    setSubmitting(false)

    if (res.success) {
      setVisited(true)
      if (!res.already) setCount(c => c + 1)
      // 기록이 끝나면 사진 단계로 (남길 자리가 있을 때만)
      if (room > 0) { setJustRecorded(true); setStep('photo') }
      else { setStep(null); flash(res.already ? '이미 기록된 이벤트예요' : '기록했어요! 연대기에 남았습니다') }
    } else {
      setStep(null)
      flash(res.error ?? '기록에 실패했어요')
    }
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).filter(f => f.type.startsWith('image/'))
    e.target.value = ''   // 같은 사진을 다시 골라도 onChange 가 오게
    if (!files.length) return
    setPicked(prev => {
      const free = Math.max(0, room - prev.length)
      const add = files.slice(0, free).map(file => ({ file, url: URL.createObjectURL(file) }))
      if (files.length > free) flash(`사진은 이벤트당 ${MAX_VISIT_PHOTOS}장까지 남길 수 있어요`)
      return [...prev, ...add]
    })
  }
  function unpick(i: number) {
    setPicked(prev => { URL.revokeObjectURL(prev[i].url); return prev.filter((_, j) => j !== i) })
  }

  async function savePhotos() {
    if (!user || !picked.length || uploading) return
    setUploading(true)
    try {
      const n = await uploadVisitPhotos(user.id, eventId, picked.map(p => p.file))
      setPhotoCount(c => c + n)
      setUploading(false)
      clearPicked()
      setStep(null)
      flash(`사진 ${n}장을 연대기에 남겼어요`)
    } catch (e: any) {
      setUploading(false)
      flash(e?.message ?? '사진을 저장하지 못했어요')
    }
  }

  function skipPhotos() {
    closeModal()
    if (justRecorded) flash('기록했어요! 연대기에 남았습니다')
  }

  const modal = step && typeof document !== 'undefined' && createPortal(
    <div className={styles.backdrop} onClick={closeModal}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="ev-visit-title" onClick={e => e.stopPropagation()}>
        {step === 'confirm' ? (
          <>
            <div className={styles.modalIcon}><EventIcon name="pin" size={24} color="var(--accent)" /></div>
            <h3 id="ev-visit-title" className={styles.modalTitle}>이 이벤트에 다녀오셨나요?</h3>
            <p className={styles.modalEvent}>{eventTitle}</p>
            <p className={styles.modalDesc}>다녀온 이벤트로 기록하면 내 연대기에 남아요.</p>
            <div className={styles.modalActions}>
              <button type="button" className={styles.modalCancel} onClick={closeModal} disabled={submitting}>취소</button>
              <button type="button" className={styles.modalOk} onClick={confirmVisit} disabled={submitting} autoFocus>
                {submitting ? '기록 중…' : '네, 다녀왔어요'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className={styles.modalIcon}><EventIcon name="sparkle" size={24} color="var(--accent)" /></div>
            <h3 id="ev-visit-title" className={styles.modalTitle}>특전이나 음식 사진도 남길까요?</h3>
            <p className={styles.modalDesc}>
              받은 특전·먹은 메뉴·산 굿즈를 찍어두면 연대기에 함께 남아요.<br />
              사진은 <b>내 프로필 방문 기록에도 공개</b>돼요. (최대 {MAX_VISIT_PHOTOS}장{photoCount > 0 ? `, ${room}장 더 가능` : ''})
            </p>

            {picked.length > 0 && (
              <div className={styles.pickGrid}>
                {picked.map((p, i) => (
                  <div key={p.url} className={styles.pickItem}>
                    <img src={p.url} alt="" />
                    {!uploading && (
                      <button type="button" className={styles.pickRemove} onClick={() => unpick(i)} aria-label={`사진 ${i + 1} 빼기`}>×</button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {picked.length < room && (
              <div className={styles.pickButtons}>
                <button type="button" className={styles.pickBtn} onClick={() => cameraRef.current?.click()} disabled={uploading}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13.5" r="3.5" /></svg>
                  카메라로 찍기
                </button>
                <button type="button" className={styles.pickBtn} onClick={() => albumRef.current?.click()} disabled={uploading}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2" /><path d="m5 19 5-4 3 2 3-3 3 3" /></svg>
                  앨범에서 고르기
                </button>
              </div>
            )}
            {/* 모바일은 capture 로 바로 카메라가 열리고, PC 는 파일 선택 창이 열린다 */}
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={onPick} />
            <input ref={albumRef} type="file" accept="image/*" multiple hidden onChange={onPick} />

            <div className={styles.modalActions}>
              <button type="button" className={styles.modalCancel} onClick={skipPhotos} disabled={uploading}>
                {justRecorded ? '건너뛰기' : '닫기'}
              </button>
              <button type="button" className={styles.modalOk} onClick={savePhotos} disabled={uploading || picked.length === 0}
                style={{ opacity: picked.length === 0 ? 0.5 : 1 }}>
                {uploading ? '올리는 중…' : picked.length ? `사진 ${picked.length}장 남기기` : '사진을 골라주세요'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  )

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

      {/* 이미 다녀온 이벤트 — 사진은 나중에라도 추가(3장까지) */}
      {visited && room > 0 && (
        <button type="button" className={styles.photoAdd} onClick={() => { setJustRecorded(false); setStep('photo') }}>
          + 사진 남기기{photoCount > 0 ? ` (${photoCount}/${MAX_VISIT_PHOTOS})` : ''}
        </button>
      )}

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

      {/* 확인·사진 창 — 히어로가 overflow:hidden·filter 를 써서 안에 두면 잘리므로 body 로 띄운다 */}
      {modal}
    </div>
  )
}
