'use client'
import { useEffect, useRef, ReactNode } from 'react'
import styles from './adminConfirmModal.module.css'

/* 관리자 화면 공통 확인 모달.

   PostReportsTab 안에 있던 ConfirmModal 을 그대로 꺼내 일반화한 것이다.
   동작은 바꾸지 않았다 — focus trap, 초기 포커스, ESC 닫기, 배경 클릭 닫기,
   body 스크롤 잠금, 닫힐 때 원래 버튼으로 포커스 복귀까지 같다.

   ⭐ Enter 를 가로채는 전역 핸들러를 두지 않는다.
      한글 IME 조합 중 Enter 는 "조합 확정"이라, 전역 Enter 핸들러가 있으면
      글자를 확정하려다 확인 버튼이 눌린다. 여기서는 Escape 와 Tab 만 처리하고
      Enter 는 포커스된 버튼의 기본 동작에만 맡긴다.

   ⭐ cancelRef 로 최신 onCancel 을 들고 있고 effect 의 deps 는 [] 다.
      onCancel 이 매 렌더마다 새 함수여도 리스너를 다시 달지 않는다.
      (다시 달면 그 사이 눌린 키가 새 리스너에 잡혀 이상하게 동작한다) */

export type ConfirmTone = 'normal' | 'danger' | 'warn' | 'success' | 'ghost'

const TONE_CLASS: Record<ConfirmTone, string> = {
  normal:  styles.btnPrimary,   // 핑크 — 주요 저장
  danger:  styles.btnDanger,    // 빨강 — 되돌리기 어려운 작업
  warn:    styles.btnWarn,      // 주황 — 주의
  success: styles.btnSuccess,   // 초록 — 정상 처리
  ghost:   styles.btnGhost,     // 중립
}

export default function AdminConfirmModal({
  title,
  body,
  description,
  confirmLabel,
  cancelLabel = '취소',
  tone = 'normal',
  busy = false,
  busyLabel = '처리 중…',
  labelledById = 'admin-confirm-title',
  onCancel,
  onConfirm,
}: {
  title: string
  /** 대상 이름 등 굵게 보여줄 한 줄. 문자열이나 노드 모두 받는다 */
  body?: ReactNode
  /** 이 작업이 무엇을 바꾸는지 설명하는 회색 문단 */
  description?: ReactNode
  confirmLabel: string
  cancelLabel?: string
  tone?: ConfirmTone
  busy?: boolean
  busyLabel?: string
  /** 한 화면에 모달이 여러 종류일 때 id 충돌을 피한다 */
  labelledById?: string
  onCancel: () => void
  onConfirm: () => void
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<Element | null>(null)
  const cancelRef = useRef(onCancel)
  useEffect(() => { cancelRef.current = onCancel })

  useEffect(() => {
    openerRef.current = document.activeElement
    const box = boxRef.current
    box?.querySelector<HTMLElement>('[data-autofocus], button')?.focus()

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); cancelRef.current(); return }
      if (e.key !== 'Tab' || !box) return
      const items = box.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input, textarea, a[href], [tabindex]:not([tabindex="-1"])')
      if (items.length === 0) return
      const first = items[0], last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      ;(openerRef.current as HTMLElement | null)?.focus?.()
    }
  }, [])

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div
        ref={boxRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledById}
        onClick={e => e.stopPropagation()}
      >
        <h2 id={labelledById} className={styles.title}>{title}</h2>
        {body && <p className={styles.body}>{body}</p>}
        {description && <p className={styles.muted}>{description}</p>}
        <div className={styles.acts}>
          <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            data-autofocus
            className={`${styles.btn} ${TONE_CLASS[tone]}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
