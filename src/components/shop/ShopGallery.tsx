'use client'
import { useState } from 'react'
import AppIcon from '@/components/tds/AppIcon'

interface ShopGalleryProps {
  images: string[]
  shopName: string
  onBack: () => void
  isSaved: boolean
  onToggleSave: () => void
  onShare: () => void
  fallbackIcon?: string
  fallbackBg?: string
}

const H = 340

export default function ShopGallery({
  images, shopName, onBack, isSaved, onToggleSave, onShare,
  fallbackIcon = 'shop', fallbackBg = 'var(--surface2)',
}: ShopGalleryProps) {
  const [idx, setIdx] = useState(0)
  const hasImages = images.length > 0
  const multi = images.length > 1

  return (
    <div style={{ position: 'relative', height: H, background: fallbackBg, overflow: 'hidden' }}>
      {hasImages ? (
        <img src={images[idx]} alt={shopName}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      ) : (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 72 }}>
          <AppIcon name={fallbackIcon} size={72} color="var(--muted)" />
        </div>
      )}

      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 96,
        background: 'linear-gradient(to bottom, rgba(0,0,0,.28), rgba(0,0,0,0))', pointerEvents: 'none' }} />
      {hasImages && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 90,
          background: 'linear-gradient(to top, rgba(0,0,0,.3), rgba(0,0,0,0))', pointerEvents: 'none' }} />
      )}

      <FloatBtn style={{ left: 14, top: 14 }} onClick={onBack} label="뒤로">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
      </FloatBtn>

      <div style={{ position: 'absolute', right: 14, top: 14, display: 'flex', gap: 10 }}>
        <FloatBtn onClick={onToggleSave} label="저장" active={isSaved}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill={isSaved ? '#FF6B6B' : 'none'} stroke={isSaved ? '#FF6B6B' : 'currentColor'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" /></svg>
        </FloatBtn>
        <FloatBtn onClick={onShare} label="공유">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>
        </FloatBtn>
      </div>

      {multi && (
        <div style={{ position: 'absolute', right: 14, bottom: 14,
          background: 'rgba(0,0,0,.55)', color: '#fff', fontSize: 12, fontWeight: 700,
          padding: '4px 10px', borderRadius: 20, letterSpacing: '.02em' }}>
          {idx + 1} / {images.length}
        </div>
      )}

      {multi && (
        <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 5 }}>
          {images.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)} aria-label={`${i + 1}번 이미지`}
              style={{ width: i === idx ? 20 : 6, height: 6, borderRadius: 3, border: 'none', padding: 0, cursor: 'pointer',
                background: i === idx ? '#fff' : 'rgba(255,255,255,.5)', transition: 'all .2s' }} />
          ))}
        </div>
      )}

      {multi && idx > 0 && <Arrow side="left" onClick={() => setIdx((i) => i - 1)} />}
      {multi && idx < images.length - 1 && <Arrow side="right" onClick={() => setIdx((i) => i + 1)} />}
    </div>
  )
}

function FloatBtn({ children, onClick, style, label, active }: {
  children: React.ReactNode; onClick: () => void; style?: React.CSSProperties; label: string; active?: boolean
}) {
  return (
    <button onClick={onClick} aria-label={label}
      style={{
        position: style?.left !== undefined || style?.top !== undefined ? 'absolute' : 'static',
        width: 40, height: 40, borderRadius: '50%', border: 'none', cursor: 'pointer',
        background: active ? '#fff' : 'rgba(255,255,255,.92)', color: '#20202D',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,.18)', backdropFilter: 'blur(4px)',
        transition: 'transform .1s', ...style,
      }}
      onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(.92)')}
      onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}>
      {children}
    </button>
  )
}

function Arrow({ side, onClick }: { side: 'left' | 'right'; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label={side === 'left' ? '이전' : '다음'}
      style={{ position: 'absolute', ...(side === 'left' ? { left: 10 } : { right: 10 }), top: '50%', transform: 'translateY(-50%)',
        width: 34, height: 34, borderRadius: '50%', border: 'none', cursor: 'pointer',
        background: 'rgba(0,0,0,.34)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d={side === 'left' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'} />
      </svg>
    </button>
  )
}


