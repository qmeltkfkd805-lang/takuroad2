'use client'
import { CSSProperties, useEffect, useState } from 'react'
import { Taku, TakuPose } from './Taku'

type CelebrationVariant = 'checkin' | 'collection' | 'route'

interface CelebrationModalProps {
  open: boolean
  variant: CelebrationVariant
  eyebrow?: string
  title: string
  description?: string
  subDescription?: string
  stampKind?: string
  pose?: TakuPose
  canMakeMemorial?: boolean
  onMakeMemorial?: () => Promise<void> | void
  confirmLabel?: string
  onClose: () => void
}

const VARIANT_DEFAULT: Record<CelebrationVariant, { eyebrow: string; pose: TakuPose; gold: boolean }> = {
  checkin:    { eyebrow: '체크인 완료!', pose: 'checkin', gold: false },
  collection: { eyebrow: '컬렉션 달성!', pose: 'checkin', gold: true },
  route:      { eyebrow: '루트 완주!',   pose: 'checkin', gold: true },
}

type MemorialPhase = 'idle' | 'making' | 'done'

export function CelebrationModal({
  open, variant, eyebrow, title, description, subDescription, stampKind, pose,
  canMakeMemorial = false, onMakeMemorial, confirmLabel = '좋아요!', onClose,
}: CelebrationModalProps) {
  const v = VARIANT_DEFAULT[variant]
  const gold = v.gold
  const showStamp = !!stampKind
  const [phase, setPhase] = useState<MemorialPhase>('idle')

  useEffect(() => {
    if (!open) return
    setPhase('idle')
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open, onClose])

  if (!open) return null

  const cardBg: CSSProperties = gold
    ? { background: 'linear-gradient(135deg,#FFF9EC,#FFFFFF)', border: '1.5px solid #F5D88A' }
    : { background: 'var(--surface)', border: '1px solid var(--border)' }

  const handleMake = async () => {
    if (phase !== 'idle') return
    setPhase('making')
    try { await onMakeMemorial?.() } catch { /* 무시 */ }
    setTimeout(() => setPhase('done'), 1000)
  }

  return (
    <div
      onClick={phase === 'idle' ? onClose : undefined}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(32,32,45,.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24, animation: 'tds-celeb-fade .2s ease both',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog" aria-modal="true"
        style={{
          position: 'relative', width: 300, maxWidth: '100%',
          borderRadius: 24, padding: '28px 24px 22px', textAlign: 'center',
          boxShadow: '0 12px 40px rgba(0,0,0,.18)',
          animation: 'tds-celeb-in .34s cubic-bezier(.2,.9,.3,1.1) both',
          ...cardBg,
        }}
      >
        {phase === 'making' ? (
          <div style={{ padding: '52px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
            <div style={{ width: 40, height: 40, borderRadius: 9999, border: '4px solid #F3E6C4', borderTopColor: 'var(--accent)', animation: 'tds-celeb-spin .8s linear infinite' }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: gold ? '#946400' : 'var(--text)' }}>기념장을 만들고 있어요...</div>
          </div>
        ) : phase === 'done' ? (
          <div style={{ padding: '48px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 56, height: 56, borderRadius: 9999, background: '#E1F7F2', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'tds-celeb-pop .4s cubic-bezier(.3,1.3,.5,1) both' }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#0E7A63" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg>
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>기념장이 저장됐어요!</div>
            <button onClick={onClose} style={{ marginTop: 6, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', padding: '11px 28px', borderRadius: 13, cursor: 'pointer' }}>확인</button>
          </div>
        ) : (
          <>
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, animation: 'tds-celeb-bounce .5s cubic-bezier(.3,1.4,.5,1) .15s both' }}>
                <Taku pose={pose ?? v.pose} size={108} />
              </div>

              <div style={{ fontSize: 22, fontWeight: 900, color: gold ? '#946400' : 'var(--accent)', letterSpacing: '-.01em', marginBottom: 10 }}>{eyebrow ?? v.eyebrow}</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', marginBottom: description || subDescription ? 8 : 0 }}>{title}</div>
              {description && (
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--muted)', lineHeight: 1.5 }}>{description}</div>
              )}
              {subDescription && (
                <div style={{ fontSize: 13, fontWeight: 600, color: gold ? '#B08A3C' : 'var(--muted)', marginTop: 2 }}>{subDescription}</div>
              )}

              {showStamp && (
                <>
                  <span aria-hidden="true" style={{ position: 'absolute', right: -18, bottom: -34, width: 120, height: 120, borderRadius: 9999, border: '3px solid #E0A48C', pointerEvents: 'none', animation: 'tds-celeb-ring .5s ease-out .42s both' }} />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/stamps/${stampKind}.png`} alt="" aria-hidden="true" style={{ position: 'absolute', right: -30, bottom: -48, width: 150, height: 150, pointerEvents: 'none', transformOrigin: 'center', mixBlendMode: 'multiply', animation: 'tds-celeb-stamp .46s cubic-bezier(.3,1.3,.5,1) .35s both' }} />
                </>
              )}
            </div>

            <div style={{ position: 'relative', zIndex: 2, marginTop: showStamp ? 30 : 22, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {canMakeMemorial ? (
                <>
                  <button onClick={handleMake} style={{ width: '100%', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', padding: 13, borderRadius: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, transition: 'transform .1s' }} onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(.97)')} onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')} onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-6 9 6v11H3z" /><path d="M9 21V12h6v9" /></svg>
                    기념장 만들기
                  </button>
                  <button onClick={onClose} style={{ width: '100%', border: 'none', background: 'transparent', color: '#9B968D', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', padding: 7, cursor: 'pointer' }}>계속 둘러보기</button>
                </>
              ) : (
                <button onClick={onClose} style={{ width: '100%', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', padding: 13, borderRadius: 13, cursor: 'pointer' }}>{confirmLabel}</button>
              )}
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes tds-celeb-fade { 0%{opacity:0} 100%{opacity:1} }
        @keyframes tds-celeb-in { 0%{ transform:translateY(18px) scale(.92); opacity:0 } 100%{ transform:translateY(0) scale(1); opacity:1 } }
        @keyframes tds-celeb-bounce { 0%{ transform:translateY(8px) scale(.9); opacity:0 } 60%{ transform:translateY(-4px) scale(1.04) } 100%{ transform:translateY(0) scale(1); opacity:1 } }
        @keyframes tds-celeb-stamp {
          0%   { transform: rotate(-38deg) scale(2.1); opacity:0 }
          55%  { transform: rotate(-16deg) scale(.92); opacity:1 }
          72%  { transform: rotate(-21deg) scale(1.07) }
          100% { transform: rotate(-18deg) scale(1);   opacity:.95 }
        }
        @keyframes tds-celeb-ring { 0%{ transform:scale(.3); opacity:.5 } 100%{ transform:scale(1.7); opacity:0 } }
        @keyframes tds-celeb-spin { to { transform: rotate(360deg) } }
        @keyframes tds-celeb-pop { 0%{ transform:scale(.4); opacity:0 } 100%{ transform:scale(1); opacity:1 } }
        @media (prefers-reduced-motion: reduce) {
          [role="dialog"], [role="dialog"] * { animation-duration:.01ms !important; }
        }
      `}</style>
    </div>
  )
}






