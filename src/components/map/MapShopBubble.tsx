'use client'

import { useRouter } from 'next/navigation'
import { Shop } from '@/types/shop'
import { ROUTES } from '@/lib/constants/routes'
import { CATEGORY_NAME_MAP } from '@/lib/constants/categories'
import { getTodayStatus } from '@/lib/utils/date'

/* 지도에서 고른 샵 — 샵 위치(핀 위)에 뜨는 말풍선.
   예전 가운데 모달(MapPinModal)과 같은 정보: 커버 · 이름 · 오늘 영업 · 주소 · 카테고리 · 전체보기.
   KakaoMap 의 bubble 로 넘기면 카카오 오버레이 안에 포털로 그려진다. */

const ClockIco = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
const PinIco = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M12 21c-4.5-5.5-6.6-9.4-6.6-12.5a6.6 6.6 0 0 1 13.2 0c0 3.1-2.1 7-6.6 12.5z" /><circle cx="12" cy="8.5" r="2.3" /></svg>

interface Props {
  shop: Shop
  onClose: () => void
}

export default function MapShopBubble({ shop, onClose }: Props) {
  const router = useRouter()
  const cover = shop.eventCover ?? shop.images?.[0]
  const today = getTodayStatus(shop.hours)
  const href = ROUTES.shop(shop.slug)

  const row = (icon: React.ReactNode, text: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.45, minWidth: 0 }}>
      {icon}<span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{text}</span>
    </div>
  )

  return (
    <div
      role="dialog"
      aria-label={shop.name}
      style={{
        position: 'relative', pointerEvents: 'auto',
        width: 'min(272px, calc(100vw - 32px))',
        filter: 'drop-shadow(0 8px 22px rgba(0,0,0,.22))',
        animation: 'mapBubbleIn .18s cubic-bezier(.32,.72,0,1)',
        transformOrigin: 'center bottom',
        cursor: 'default', textAlign: 'left',
      }}
    >
      <style>{`@keyframes mapBubbleIn{from{transform:translateY(6px) scale(.96);opacity:0}to{transform:none;opacity:1}}`}</style>

      <div style={{ background: 'var(--surface)', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border)' }}>
        {/* 커버 */}
        <div
          onClick={() => router.push(href)}
          style={{ position: 'relative', height: 112, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          {cover
            ? <img src={cover} alt={shop.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            : <span style={{ color: 'var(--muted)', fontSize: 13 }}>샵</span>}
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onClose() }}
            aria-label="닫기"
            style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 9999, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>

        <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.3, color: 'var(--text)', wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>{shop.name}</div>

          {today?.todayHours && row(<ClockIco />, `${today.label} · ${today.todayHours}`)}
          {shop.addr && row(<PinIco />, shop.addr)}

          {shop.cats?.length > 0 && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 2 }}>
              {shop.cats.slice(0, 3).map(c => {
                const ci = CATEGORY_NAME_MAP[c]
                const color = ci?.color ?? '#e8006f'
                return (
                  <span key={c} style={{ fontSize: 11.5, fontWeight: 700, padding: '2px 9px', borderRadius: 9999, background: ci?.bgColor ?? 'rgba(232,0,111,.1)', color, border: `1px solid ${color}33` }}>{c}</span>
                )
              })}
            </div>
          )}

          <button
            type="button"
            onClick={() => router.push(href)}
            style={{ width: '100%', marginTop: 8, padding: '10px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            전체보기
          </button>
        </div>
      </div>

      {/* 말풍선 꼬리 — 핀 머리를 가리킨다 */}
      <div aria-hidden style={{
        position: 'absolute', left: '50%', bottom: -7, width: 14, height: 14,
        transform: 'translateX(-50%) rotate(45deg)',
        background: 'var(--surface)', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
        borderBottomRightRadius: 3,
      }} />
    </div>
  )
}
