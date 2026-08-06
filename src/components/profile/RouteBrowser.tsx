'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import RouteCard, { UIRoute, RouteMenuItem } from './RouteCard'

/* 루트 목록 브라우저 — 만든/저장한/완주한 루트 공통.
   필터 한 줄(지역 · 정렬 · 2열/1열 보기) + 반응형 2열 그리드 + RouteCard. */

type Sort = 'recent' | 'name' | 'stops'
const SORT_LABEL: Record<Sort, string> = { recent: '최신순', name: '이름순', stops: '장소순' }

function Dropdown({ label, options, onPick }: {
  label: string
  options: { key: string; label: string; active: boolean }[]
  onPick: (key: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])
  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button onClick={() => setOpen(o => !o)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, minHeight: 40, padding: '0 10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
        {label}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 40, marginTop: 6, minWidth: 150, maxHeight: 300, overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,.16)', padding: 6 }}>
          {options.map(o => (
            <button key={o.key} onClick={() => { onPick(o.key); setOpen(false) }} style={{ display: 'block', width: '100%', textAlign: 'left', minHeight: 40, border: 'none', background: o.active ? 'var(--accent-l, rgba(232,0,111,.1))' : 'none', color: o.active ? 'var(--accent)' : 'var(--text)', padding: '0 12px', borderRadius: 8, fontSize: 14, fontWeight: o.active ? 800 : 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>{o.label}</button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function RouteBrowser({ routes, badgeFor, menuFor, emptyText }: {
  routes: UIRoute[]
  badgeFor?: (r: UIRoute) => { text: string; bg: string } | null
  menuFor?: (r: UIRoute) => RouteMenuItem[] | null
  emptyText: string
}) {
  const [region, setRegion] = useState<string | null>(null)
  const [sort, setSort] = useState<Sort>('recent')
  const [cols, setCols] = useState<1 | 2>(2)

  const regionList = useMemo(() => {
    const s = new Set<string>()
    for (const r of routes) for (const g of r.regions) s.add(g)
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'ko'))
  }, [routes])

  const shown = useMemo(() => {
    let list = region ? routes.filter(r => r.regions.includes(region)) : routes.slice()
    if (sort === 'name') list = list.slice().sort((a, b) => (a.title || '').localeCompare(b.title || '', 'ko'))
    else if (sort === 'stops') list = list.slice().sort((a, b) => b.stopCount - a.stopCount)
    // recent = 입력 순서 유지(서비스에서 created_at desc)
    return list
  }, [routes, region, sort])

  return (
    <div style={{ paddingTop: 14, paddingBottom: 88 }}>
      {/* 필터 한 줄 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px 12px' }}>
        <Dropdown
          label={region ?? '전체 지역'}
          options={[{ key: '__all__', label: '전체 지역', active: region === null }, ...regionList.map(g => ({ key: g, label: g, active: region === g }))]}
          onPick={(k) => setRegion(k === '__all__' ? null : k)}
        />
        <Dropdown
          label={SORT_LABEL[sort]}
          options={(Object.keys(SORT_LABEL) as Sort[]).map(s => ({ key: s, label: SORT_LABEL[s], active: sort === s }))}
          onPick={(k) => setSort(k as Sort)}
        />
        {/* 보기 전환 — 우측 */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, flexShrink: 0 }}>
          {([2, 1] as const).map(c => (
            <button key={c} onClick={() => setCols(c)} aria-label={c === 2 ? '2열 보기' : '1열 보기'} style={{ width: 40, height: 40, borderRadius: 9, border: '1px solid var(--border)', background: cols === c ? 'var(--accent)' : 'var(--surface)', color: cols === c ? '#fff' : 'var(--muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {c === 2
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="8" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /><rect x="13" y="13" width="8" height="8" rx="1.5" /></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="4" width="18" height="6" rx="1.5" /><rect x="3" y="14" width="18" height="6" rx="1.5" /></svg>}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <div style={{ padding: '50px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>{region ? `'${region}' 지역 루트가 없어요` : emptyText}</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: cols === 2 ? 'repeat(auto-fill, minmax(150px, 1fr))' : '1fr', gap: 12, padding: '0 16px' }}>
          {shown.map(r => (
            <RouteCard key={r.id} route={r} onOpen={() => { if (r.shareToken) window.location.href = '/route/' + r.shareToken }} badge={badgeFor?.(r) ?? null} menu={menuFor?.(r) ?? null} />
          ))}
        </div>
      )}
    </div>
  )
}
