'use client'

import { useState, useRef, useEffect } from 'react'

/* 루트 지역 필터 — 만든/저장한/완주한 루트 목록 공통.
   루트가 포함한 샵들의 지역(region/주소)을 모아 드롭다운으로 고르고,
   고른 지역이 포함된 루트만 남긴다. */

// 샵 하나의 지역 — region 우선, 없으면 주소 첫 어절("서울특별시 …" → "서울특별시")
function shopRegion(shop: any): string | null {
  if (!shop) return null
  if (shop.region) return String(shop.region)
  if (shop.addr) { const t = String(shop.addr).trim().split(/\s+/)[0]; return t || null }
  return null
}

// 루트 한 개가 걸친 지역들 (route_shops[].shops.region/addr 또는 이미 만들어진 regions 배열)
export function routeRegions(route: any): string[] {
  if (Array.isArray(route?.regions)) return route.regions.filter(Boolean)
  const rs = route?.route_shops ?? []
  return Array.from(new Set(rs.map((s: any) => shopRegion(s?.shops)).filter(Boolean))) as string[]
}

// 여러 루트에서 등장하는 지역 목록 (가나다순)
export function collectRegions(routes: any[]): string[] {
  const set = new Set<string>()
  for (const r of routes) for (const g of routeRegions(r)) set.add(g)
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'ko'))
}

export default function RouteRegionFilter({ regions, value, onChange }: {
  regions: string[]
  value: string | null
  onChange: (r: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  if (regions.length === 0) return null   // 지역 정보가 전혀 없을 때만 숨김

  const label = value ?? '전체 지역'
  const options: (string | null)[] = [null, ...regions]

  return (
    <div style={{ padding: '0 16px 14px' }}>
      <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
        <button
          onClick={() => setOpen(o => !o)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 40, padding: '0 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" /></svg>
          {label}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}><path d="m6 9 6 6 6-6" /></svg>
        </button>
        {open && (
          <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 40, marginTop: 6, minWidth: 160, maxHeight: 300, overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,.16)', padding: 6 }}>
            {options.map(opt => {
              const active = value === opt
              return (
                <button
                  key={opt ?? '__all__'}
                  onClick={() => { onChange(opt); setOpen(false) }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', minHeight: 40, border: 'none', background: active ? 'var(--accent-l, rgba(232,0,111,.1))' : 'none', color: active ? 'var(--accent)' : 'var(--text)', padding: '0 12px', borderRadius: 8, fontSize: 14, fontWeight: active ? 800 : 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                >
                  {opt ?? '전체 지역'}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
