'use client'

import { useState, useEffect } from 'react'
import { getShopHighlights } from '@/services/shopHighlightService'

interface Props {
  shopId: string
}

export default function ShopHighlights({ shopId }: Props) {
  const [highlights, setHighlights] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [viewerIdx, setViewerIdx] = useState<number | null>(null)

  useEffect(() => {
    getShopHighlights(shopId).then(data => {
      setHighlights(data)
      setLoading(false)
    })
  }, [shopId])

  function prev() {
    setViewerIdx(i => (i !== null && i > 0 ? i - 1 : i))
  }

  function next() {
    setViewerIdx(i => (i !== null && i < highlights.length - 1 ? i + 1 : i))
  }

  if (loading || highlights.length === 0) return null

  return (
    <div style={{ marginBottom: '24px' }}>
      <h2 style={{ fontSize: '15px', fontWeight: 900, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}><Svg size={17} color="var(--accent)" fill="var(--accent)"><path d="M12 2l3 6.3 6.9.9-5 4.8 1.2 6.8L12 17.8 5.9 20.8 7 14 2 9.2l6.9-.9z" /></Svg>이 샵 가면 꼭 보세요</h2>
      <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
        {highlights.map((h, i) => (
          <div
            key={h.id}
            onClick={() => h.image_url && setViewerIdx(i)}
            style={{ flexShrink: 0, width: '110px', cursor: h.image_url ? 'pointer' : 'default' }}
          >
            <div style={{
              width: '110px', height: '110px', borderRadius: '12px', overflow: 'hidden',
              background: 'var(--surface2)', marginBottom: '6px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px',
            }}>
              {h.image_url ? (
                <img src={h.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : <Svg size={22} color="var(--accent)" fill="var(--accent)"><path d="M12 2l3 6.3 6.9.9-5 4.8 1.2 6.8L12 17.8 5.9 20.8 7 14 2 9.2l6.9-.9z" /></Svg>}
            </div>
            <p style={{ fontSize: '12px', fontWeight: 700, textAlign: 'center', lineHeight: 1.3 }}>{h.title}</p>
          </div>
        ))}
      </div>

      {/* 이미지 확대 뷰어 */}
      {viewerIdx !== null && (
        <div
          onClick={() => setViewerIdx(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 999,
            background: 'rgba(0,0,0,.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <img
            src={highlights[viewerIdx].image_url}
            alt=""
            style={{ maxWidth: '90vw', maxHeight: '75vh', objectFit: 'contain', borderRadius: '8px' }}
            onClick={e => e.stopPropagation()}
          />

          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute', bottom: '60px', left: '50%', transform: 'translateX(-50%)',
              color: '#fff', fontSize: '14px', fontWeight: 700, textAlign: 'center',
              padding: '0 20px',
            }}
          >
            {highlights[viewerIdx].title}
          </div>

          {viewerIdx > 0 && (
            <button
              onClick={e => { e.stopPropagation(); prev() }}
              style={{
                position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)',
                background: 'rgba(255,255,255,.2)', border: 'none',
                color: '#fff', fontSize: '24px', cursor: 'pointer',
                width: '44px', height: '44px', borderRadius: '50%',
              }}
            >‹</button>
          )}
          {viewerIdx < highlights.length - 1 && (
            <button
              onClick={e => { e.stopPropagation(); next() }}
              style={{
                position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)',
                background: 'rgba(255,255,255,.2)', border: 'none',
                color: '#fff', fontSize: '24px', cursor: 'pointer',
                width: '44px', height: '44px', borderRadius: '50%',
              }}
            >›</button>
          )}
          <button
            onClick={() => setViewerIdx(null)}
            style={{
              position: 'absolute', top: '16px', right: '16px',
              background: 'rgba(255,255,255,.2)', border: 'none',
              color: '#fff', fontSize: '20px', cursor: 'pointer',
              width: '36px', height: '36px', borderRadius: '50%',
            }}
          ><Svg size={13} color="#fff"><path d="M18 6 6 18M6 6l12 12" /></Svg></button>
          {highlights.length > 1 && (
            <div style={{
              position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
              display: 'flex', gap: '6px',
            }}>
              {highlights.map((_, i) => (
                <div
                  key={i}
                  onClick={e => { e.stopPropagation(); setViewerIdx(i) }}
                  style={{
                    width: i === viewerIdx ? '20px' : '8px', height: '8px',
                    borderRadius: '4px',
                    background: i === viewerIdx ? '#fff' : 'rgba(255,255,255,.4)',
                    cursor: 'pointer', transition: 'all .2s',
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}


function Svg({ size = 14, color = 'currentColor', fill = 'none', children }: { size?: number; color?: string; fill?: string; children: React.ReactNode }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-2px', flexShrink: 0 }} aria-hidden>{children}</svg>
}
