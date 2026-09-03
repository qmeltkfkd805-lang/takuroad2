'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/components/layout/AuthProvider'
import { reportShopIssue } from '@/services/shopReportService'
import { ROUTES } from '@/lib/constants/routes'
import { useRouter } from 'next/navigation'

interface Props {
  shopId: string
  label?: string
  /** menu = 드롭다운 메뉴 한 줄로 그린다(호출부의 메뉴 항목 스타일을 style 로 받는다) */
  variant?: 'default' | 'dashed' | 'menu'
  accentColor?: string
  style?: React.CSSProperties
  /** 모달이 닫힐 때. 메뉴 안에서 열었으면 그 메뉴도 같이 닫는다.
   *  열 때가 아니라 닫을 때 부른다 — 열면서 메뉴를 닫으면 이 컴포넌트가 통째로
   *  언마운트되어 모달까지 사라진다. */
  onClose?: () => void
}

const REASONS = [
  '영업시간이 달라요',
  '연락처/SNS 정보가 틀려요',
  '굿즈/작품 정보가 달라요',
  '사진이 오래됐어요',
  '폐업했어요',
  '다른 곳으로 이전했어요',
  '중복 등록된 샵이에요',
  '존재하지 않는 샵이에요',
  '기타',
]

export default function ReportIssueButton({
  shopId, label = '정보가 달라요', variant = 'default',
  accentColor = 'var(--accent)', style, onClose,
}: Props) {
  const router = useRouter()
  const { user } = useAuth()
  const [showModal, setShowModal] = useState(false)
  const [selectedReason, setSelectedReason] = useState<string | null>(null)
  const [customReason, setCustomReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const isOther = selectedReason === '기타'
  const canSubmit = selectedReason && (!isOther || customReason.trim().length > 0)

  function handleOpen() {
    if (!user) {
      router.push(ROUTES.login)
      return
    }
    setShowModal(true)
  }

  function handleClose() {
    setShowModal(false)
    setSelectedReason(null)
    setCustomReason('')
    onClose?.()
  }

  async function handleSubmit() {
    if (!user || !canSubmit || submitting) return
    setSubmitting(true)
    const finalReason = isOther ? `기타: ${customReason.trim()}` : selectedReason!
    const ok = await reportShopIssue(shopId, user.id, finalReason)
    setSubmitting(false)
    // 예전에는 결과와 무관하게 '접수됐어요'를 띄웠다. 실패하면 그대로 알린다.
    if (!ok) { alert('신고를 접수하지 못했어요. 잠시 후 다시 시도해 주세요.'); return }
    setDone(true)
    setTimeout(() => {
      handleClose()
      setDone(false)
    }, 1500)
  }

  return (
    <>
      {variant === 'menu' ? (
        <button onClick={handleOpen} style={style}>{label}</button>
      ) : variant === 'dashed' ? (
        <button
          onClick={handleOpen}
          style={{
            width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            padding: '12px', borderRadius: '12px', border: `1.5px dashed ${accentColor}`,
            background: 'transparent', color: accentColor, fontWeight: 800, fontSize: '14px',
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {label}
        </button>
      ) : (
        <button
          onClick={handleOpen}
          style={{
            fontSize: '12px', color: 'var(--muted)', background: 'none',
            border: '1px solid var(--border)', borderRadius: '8px',
            padding: '6px 12px', cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></svg>
            {label}
          </span>
        </button>
      )}

      {/* 모달은 body 로 포털한다.
          이 버튼이 z-index 를 가진 조상(예: 샵 상세 히어로의 더보기 메뉴, zIndex 6) 안에
          있으면 그 stacking context 에 갇혀서, position:fixed + z-index:999 여도
          sticky 탭 바(zIndex 50) 아래로 깔린다.
          showModal 은 클릭으로만 켜지므로 이 시점에는 document 가 항상 있다. */}
      {showModal && typeof document !== 'undefined' && createPortal(
        <div
          onClick={() => !submitting && handleClose()}
          style={{
            position: 'fixed', inset: 0, zIndex: 999,
            background: 'rgba(0,0,0,.5)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--surface)', borderRadius: '20px 20px 0 0',
              width: '100%', maxWidth: '680px', padding: '20px',
            }}
          >
            {done ? (
              <p style={{ textAlign: 'center', padding: '20px 0', color: 'var(--green)', fontWeight: 700 }}>
                ✓ 신고가 접수됐어요. 확인 후 반영할게요!
              </p>
            ) : (
              <>
                <h3 style={{ fontSize: '15px', fontWeight: 900, marginBottom: '14px' }}>
                  어떤 정보가 잘못됐나요?
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                  {REASONS.map(reason => (
                    <button
                      key={reason}
                      onClick={() => setSelectedReason(reason)}
                      style={{
                        textAlign: 'left', padding: '12px 14px', borderRadius: '10px',
                        border: `1.5px solid ${selectedReason === reason ? 'var(--accent)' : 'var(--border)'}`,
                        background: selectedReason === reason ? 'var(--accent-l)' : 'var(--surface2)',
                        fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      {reason}
                    </button>
                  ))}
                </div>

                {isOther && (
                  <textarea
                    value={customReason}
                    onChange={e => setCustomReason(e.target.value)}
                    placeholder="어떤 점이 잘못됐는지 자세히 적어주세요"
                    rows={3}
                    style={{
                      width: '100%', padding: '10px 12px', marginBottom: '16px',
                      border: '1.5px solid var(--border)', borderRadius: '10px',
                      fontSize: '13px', fontFamily: 'inherit',
                      background: 'var(--surface2)', color: 'var(--text)',
                      outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                    }}
                  />
                )}

                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit || submitting}
                  style={{
                    width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
                    background: canSubmit ? 'var(--accent)' : 'var(--border)',
                    color: '#fff', fontWeight: 700, fontSize: '14px',
                    cursor: canSubmit ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
                  }}
                >
                  {submitting ? '제출 중...' : '신고하기'}
                </button>
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}