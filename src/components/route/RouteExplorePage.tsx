'use client'
import { useState, useEffect, useMemo, CSSProperties, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { getPublicRoutes, getMyRoutes, getMyRouteProgress, toggleRouteSave, getMySavedRouteIds } from '@/services/routeService'
import { shopRegion } from '@/lib/shop/quickCompleteness'
import { formatDistance } from '@/hooks/useCurrentLocation'

/* ---- 아이콘 헬퍼 (상세페이지와 동일) ---- */
function MaskIcon({ name, size = 16, color = 'currentColor', style }: { name: string; size?: number; color?: string; style?: CSSProperties }) {
  return (
    <span aria-hidden style={{
      width: size, height: size, display: 'inline-block', flexShrink: 0, verticalAlign: '-2px',
      backgroundColor: color,
      WebkitMaskImage: `url(/icons/${name}.png)`, maskImage: `url(/icons/${name}.png)`,
      WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
      WebkitMaskSize: 'contain', maskSize: 'contain',
      WebkitMaskPosition: 'center', maskPosition: 'center',
      ...style,
    }} />
  )
}
function ColorIcon({ name, size = 16, style }: { name: string; size?: number; style?: CSSProperties }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/icons/${name}.png`} width={size} height={size} alt="" aria-hidden style={{ display: 'inline-block', objectFit: 'contain', flexShrink: 0, verticalAlign: '-3px', ...style }} />
  )
}
function Svg({ size = 16, color = 'currentColor', style, children }: { size?: number; color?: string; style?: CSSProperties; children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0, verticalAlign: '-3px', ...style }}>
      {children}
    </svg>
  )
}
const PinIcon = (p: { size?: number; color?: string; style?: CSSProperties }) => <Svg {...p}><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></Svg>
const XIcon = (p: { size?: number; color?: string; style?: CSSProperties }) => <Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>
function HeartIcon({ size = 16, color = 'currentColor', filled = false, style }: { size?: number; color?: string; filled?: boolean; style?: CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'} stroke={color} strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0, verticalAlign: '-2px', ...style }}>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.5 4.04 3 5.5l7 7Z" />
    </svg>
  )
}

type Tab = 'all' | 'official' | 'popular' | 'recent' | 'mine'
const TABS: { v: Tab; l: string }[] = [
  { v: 'all', l: '전체 루트' }, { v: 'official', l: '공식 루트' }, { v: 'popular', l: '인기 루트' }, { v: 'recent', l: '신규 루트' }, { v: 'mine', l: '내 루트' },
]
const DIFF: Record<number, { l: string; c: string }> = { 1: { l: '가볍게', c: '#22c55e' }, 2: { l: '반나절', c: '#eab308' }, 3: { l: '하루', c: '#ef4444' } }
// PNG 아이콘이 있는 테마만 매핑, 없는 건 ThemeIcon에서 SVG로
const THEME_PNG: Record<string, string> = { '카페': 'cafe', '굿즈': 'goods', '가챠': 'gacha', '사진명소': 'photo', '도보30분': 'route', '반나절': 'clock' }
function ThemeIcon({ name, size = 15, color = 'currentColor' }: { name: string; size?: number; color?: string }) {
  const png = THEME_PNG[name]
  if (png) return <MaskIcon name={png} size={size} color={color} />
  const sp = { size, color }
  switch (name) {
    case '가족': return <Svg {...sp}><circle cx="8.5" cy="8" r="2.6" /><circle cx="16" cy="9" r="2" /><path d="M4 20c0-2.8 2-5 4.5-5s4.5 2.2 4.5 5" /><path d="M12.5 20c.1-2.3 1.7-4 3.5-4s3.4 1.7 3.5 4" /></Svg>
    case '커플': return <MaskIcon name="heart" size={size} color={color} />
    case '혼자': return <Svg {...sp}><circle cx="12" cy="7.5" r="3.2" /><path d="M5.5 20c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5" /></Svg>
    case '실내': return <Svg {...sp}><path d="M4 11 12 4l8 7" /><path d="M6 10v10h12V10" /></Svg>
    case '비오는날': return <Svg {...sp}><path d="M7.5 16a4 4 0 0 1 .4-8 5 5 0 0 1 9.4 1.4A3.6 3.6 0 0 1 17 16Z" /><path d="M8 19l-1 2.5M12 19l-1 2.5M16 19l-1 2.5" /></Svg>
    default: return <Svg {...sp}><path d="M4 4h9l7 7-9 9-7-7Z" /><circle cx="8" cy="8" r="1.3" /></Svg>
  }
}

const rtTags = (r: any): string[] => Array.from(new Set((r.route_shops ?? []).flatMap((rs: any) => (rs.shops?.shop_tags ?? []).map((st: any) => st.tags?.name).filter(Boolean))))
const rtRegions = (r: any): string[] => Array.from(new Set((r.route_shops ?? []).map((rs: any) => rs.shops ? shopRegion(rs.shops) : null).filter((x: any) => x && x !== '지역 미정')))

export default function RouteExplorePage() {
  const router = useRouter()
  const { user } = useAuth()
  const [routes, setRoutes] = useState<any[]>([])
  const [mine, setMine] = useState<any[]>([])
  const [progress, setProgress] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('all')
  const [search, setSearch] = useState('')
  const [themeFilter, setThemeFilter] = useState<string | null>(null)
  const [diffFilter, setDiffFilter] = useState<number | null>(null)
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [regionFilter, setRegionFilter] = useState<string | null>(null)
  const [showFilter, setShowFilter] = useState(false)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    getPublicRoutes().then((d) => { setRoutes(d); setLoading(false) }).catch(() => setLoading(false))
  }, [])
  useEffect(() => {
    if (!user) return
    getMyRoutes(user.id).then(setMine).catch(() => {})
    getMyRouteProgress(user.id).then(setProgress).catch(() => {})
    getMySavedRouteIds(user.id).then((ids) => setSavedIds(new Set(ids))).catch(() => {})
  }, [user])

  const popular = useMemo(() => [...routes].sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0)), [routes])
  const recent = useMemo(() => [...routes].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()), [routes])
  const official = useMemo(() => routes.filter((r) => r.is_official), [routes])
  const hero = popular[0]

  const byTag = useMemo(() => {
    const m = new Map<string, number>()
    routes.forEach((r) => { const name = r.primary_tag?.name; if (name) m.set(name, (m.get(name) ?? 0) + 1) })
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12)
  }, [routes])
  const byRegion = useMemo(() => {
    const m = new Map<string, number>()
    routes.forEach((r) => rtRegions(r).forEach((x) => m.set(x, (m.get(x) ?? 0) + 1)))
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12)
  }, [routes])

  const q = search.trim().toLowerCase()
  const tabRoutes = tab === 'official' ? official : tab === 'popular' ? popular : tab === 'recent' ? recent : tab === 'mine' ? mine : routes
  let shown = q ? tabRoutes.filter((r) => (r.title ?? '').toLowerCase().includes(q)) : tabRoutes
  if (themeFilter) shown = shown.filter((r) => (r.themes ?? []).includes(themeFilter))
  if (diffFilter) shown = shown.filter((r) => r.official_difficulty === diffFilter)
  if (tagFilter) shown = shown.filter((r) => r.primary_tag?.name === tagFilter)
  if (regionFilter) shown = shown.filter((r) => rtRegions(r).includes(regionFilter))

  function go(r: any) { const t = r.share_token ?? r.shareToken; if (t) router.push(`/route/${t}`) }
  async function onSave(e: React.MouseEvent, r: any) {
    e.stopPropagation()
    if (!user) { router.push('/login'); return }
    const wasSaved = savedIds.has(r.id)
    setSavedIds((prev) => { const n = new Set(prev); wasSaved ? n.delete(r.id) : n.add(r.id); return n })
    await toggleRouteSave(r.id, user.id).catch(() => {
      setSavedIds((prev) => { const n = new Set(prev); wasSaved ? n.add(r.id) : n.delete(r.id); return n })
    })
  }

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>루트 불러오는 중...</div>

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap', padding: 16 }}>
      {/* 메인 */}
      <div style={{ flex: '1 1 520px', minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><ColorIcon name="colormap" size={26} />루트</h1>
          <button onClick={() => router.push('/route/new')} style={{ padding: '9px 16px', borderRadius: 9999, border: '1px solid var(--accent)', background: 'var(--surface)', color: 'var(--accent)', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>+ 루트 만들기</button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', display: 'flex', color: 'var(--muted)' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3-3" /></svg></span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="루트 이름 검색" style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px 11px 38px', borderRadius: 9999, border: '1px solid var(--border)', fontFamily: 'inherit', fontSize: 14, background: 'var(--surface)', color: 'var(--text)' }} />
          </div>
          <button onClick={() => setShowFilter((v) => !v)} style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 16px', borderRadius: 9999, border: `1px solid ${(diffFilter || themeFilter) ? 'var(--accent)' : 'var(--border)'}`, background: (diffFilter || themeFilter) ? 'var(--accent)' : 'var(--surface)', color: (diffFilter || themeFilter) ? '#fff' : 'var(--text)', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 5h18M6 12h12M10 19h4" /></svg>필터{(diffFilter || themeFilter) ? ` ${(diffFilter ? 1 : 0) + (themeFilter ? 1 : 0)}` : ''}
          </button>
        </div>
        {showFilter && (
          <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 16, marginBottom: 14, background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', marginBottom: 8 }}>난이도</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
              {[1, 2, 3].map((v) => { const d = DIFF[v]; const on = diffFilter === v; return (
                <button key={v} onClick={() => setDiffFilter(on ? null : v)} style={{ padding: '7px 14px', borderRadius: 9999, border: `1px solid ${on ? d.c : 'var(--border)'}`, background: on ? d.c : 'var(--surface)', color: on ? '#fff' : 'var(--text)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>{d.l}</button>
              )})}
            </div>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', marginBottom: 8 }}>추천 테마</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['카페', '굿즈', '사진명소', '가족', '커플', '혼자', '실내', '비오는날'].map((th) => { const on = themeFilter === th; return (
                <button key={th} onClick={() => setThemeFilter(on ? null : th)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 13px', borderRadius: 9999, border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'var(--accent)' : 'var(--surface)', color: on ? '#fff' : 'var(--text)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}><ThemeIcon name={th} size={14} color={on ? '#fff' : 'currentColor'} />{th}</button>
              )})}
            </div>
            {(diffFilter || themeFilter) && (
              <button onClick={() => { setDiffFilter(null); setThemeFilter(null) }} style={{ marginTop: 14, background: 'none', border: 'none', color: 'var(--muted)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>필터 초기화</button>
            )}
          </div>
        )}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 16 }}>
          {TABS.map((t) => (
            <button key={t.v} onClick={() => setTab(t.v)} style={{ flexShrink: 0, padding: '8px 14px', borderRadius: 9999, border: 'none', background: tab === t.v ? 'var(--accent)' : 'var(--surface2)', color: tab === t.v ? '#fff' : 'var(--text)', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>{t.l}</button>
          ))}
        </div>

        {tab === 'all' && !q && !themeFilter && !diffFilter && !tagFilter && !regionFilter && hero && (
          <div style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 22 }}>
            <div style={{ backgroundImage: hero.cover_image_url ? `linear-gradient(to top, rgba(0,0,0,.55), rgba(0,0,0,.15)), url(${hero.cover_image_url})` : 'linear-gradient(135deg, var(--accent), #ff8fb1)', backgroundSize: 'cover', backgroundPosition: 'center', padding: '30px 24px', color: '#fff' }}>
              <span style={{ background: 'rgba(0,0,0,.2)', fontSize: 12, fontWeight: 800, padding: '3px 10px', borderRadius: 9999 }}>공식 추천</span>
              <div style={{ fontSize: 26, fontWeight: 900, margin: '12px 0 6px' }}>{hero.title}</div>
              {hero.description && <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 14 }}>{hero.description}</div>}
              <div style={{ display: 'flex', gap: 18, fontSize: 14, fontWeight: 700, alignItems: 'center' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><MaskIcon name="shop" size={15} color="#fff" />{hero.route_shops?.length ?? 0}곳</span>
                {hero.total_distance_m ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><MaskIcon name="route" size={15} color="#fff" />{formatDistance(hero.total_distance_m)}</span> : null}
                {hero.official_difficulty ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><MaskIcon name="clock" size={15} color="#fff" />{DIFF[hero.official_difficulty]?.l ?? ''}</span> : null}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><HeartIcon size={15} filled color="#fff" />{hero.likes ?? 0}</span>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                <button onClick={() => go(hero)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff', color: 'var(--accent)', fontWeight: 800, fontSize: 14, padding: '11px 22px', borderRadius: 9999, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}><PinIcon size={16} color="var(--accent)" />루트 보기</button>
                <button onClick={(e) => onSave(e, hero)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: savedIds.has(hero.id) ? 'var(--accent)' : 'rgba(255,255,255,.2)', color: '#fff', fontWeight: 800, fontSize: 14, padding: '11px 20px', borderRadius: 9999, border: '1px solid rgba(255,255,255,.5)', cursor: 'pointer', fontFamily: 'inherit' }}><HeartIcon size={16} filled={savedIds.has(hero.id)} color="#fff" />{savedIds.has(hero.id) ? '저장됨' : '저장하기'}</button>
              </div>
            </div>
          </div>
        )}

        {(tagFilter || regionFilter) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>{tagFilter ? '작품' : '지역'}</span>
            <button onClick={() => { setTagFilter(null); setRegionFilter(null) }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 9999, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>{tagFilter ?? regionFilter}<XIcon size={13} color="#fff" /></button>
          </div>
        )}
        {tab === 'all' && !q && !themeFilter && !diffFilter && !tagFilter && !regionFilter ? (
          <>
            {byTag.length > 0 && (
              <Section title="작품별 루트">
                {byTag.map(([t, n]) => <MiniCard key={t} label={t} sub={`루트 ${n}개`} onClick={() => { setTagFilter(t); setRegionFilter(null); setThemeFilter(null); setDiffFilter(null); setTab('all') }} />)}
              </Section>
            )}
            {byRegion.length > 0 && (
              <Section title="지역별 루트">
                {byRegion.map(([r, n]) => <MiniCard key={r} icon={<PinIcon size={13} color="var(--accent)" />} label={r} sub={`루트 ${n}개`} onClick={() => { setRegionFilter(r); setTagFilter(null); setThemeFilter(null); setDiffFilter(null); setTab('all') }} />)}
              </Section>
            )}
          </>
        ) : (
          <>
            {tab === 'mine' && !user ? (
              <EmptyBox text="로그인하면 내 루트를 볼 수 있어요" />
            ) : shown.length === 0 ? (
              <EmptyBox text="루트가 없어요" />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                {shown.map((r) => <Card key={r.id} r={r} onGo={go} saved={savedIds.has(r.id)} onSave={onSave} />)}
              </div>
            )}
          </>
        )}
      </div>

      {/* 오른쪽 사이드 */}
      <aside style={{ flex: '1 1 300px', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Panel title="오늘의 인기 루트">
          {popular.slice(0, 5).map((r, i) => {
            const dl = r.official_difficulty ? DIFF[r.official_difficulty] : null
            return (
            <button key={r.id} onClick={() => go(r)} style={{ display: 'flex', gap: 12, alignItems: 'center', width: '100%', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', padding: '12px 0', cursor: 'pointer', fontFamily: 'inherit' }}>
              <div style={{ position: 'relative', width: 56, height: 56, borderRadius: 12, flexShrink: 0, overflow: 'hidden', backgroundImage: r.cover_image_url ? `url(${r.cover_image_url})` : 'linear-gradient(135deg, var(--accent), #ff9bb6)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
                <span style={{ position: 'absolute', top: 0, left: 0, width: 20, height: 20, borderRadius: '0 0 8px 0', background: i < 3 ? 'var(--accent)' : 'rgba(0,0,0,0.55)', color: '#fff', fontWeight: 800, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>{r.route_shops?.length ?? 0}곳{r.total_distance_m ? ` · ${formatDistance(r.total_distance_m)}` : ''}{dl ? ` · ` : ''}{dl ? <span style={{ color: dl.c, fontWeight: 700 }}>{dl.l}</span> : null}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, display: 'inline-flex', alignItems: 'center', gap: 3 }}><HeartIcon size={11} filled color="var(--accent)" />{r.likes ?? 0}</div>
              </div>
            </button>
            )
          })}
          {popular.length === 0 && <p style={{ fontSize: 13, color: 'var(--muted)', padding: '10px 0' }}>아직 루트가 없어요</p>}
        </Panel>

        {user && progress.length > 0 && (
          <Panel title="내 루트 진행 현황">
            {progress.map((p) => (
              <button key={p.id} onClick={() => p.shareToken && router.push(`/route/${p.shareToken}`)} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '8px 0', cursor: 'pointer', fontFamily: 'inherit' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, marginBottom: 5 }}>
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</span>
                  <span style={{ color: 'var(--accent)', flexShrink: 0, marginLeft: 8 }}>{p.pct}%</span>
                </div>
                <div style={{ height: 6, borderRadius: 9999, background: 'var(--surface2)', overflow: 'hidden' }}>
                  <div style={{ width: `${p.pct}%`, height: '100%', background: 'var(--accent)' }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>{p.visited}/{p.total}곳</div>
              </button>
            ))}
          </Panel>
        )}
      </aside>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <h2 style={{ fontSize: 16, fontWeight: 900, margin: '0 0 10px' }}>{title}</h2>
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>{children}</div>
    </div>
  )
}
function MiniCard({ label, sub, onClick, icon }: { label: string; sub: string; onClick: () => void; icon?: ReactNode }) {
  return (
    <button onClick={onClick} style={{ flexShrink: 0, width: 130, border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', cursor: 'pointer', fontFamily: 'inherit', background: 'var(--surface)', padding: 0, textAlign: 'left' }}>
      <div style={{ height: 80, background: 'linear-gradient(135deg, var(--accent), #ff8fb1)' }} />
      <div style={{ padding: '8px 10px 10px' }}>
        <div style={{ fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 5 }}>
          {icon}<span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>
      </div>
    </button>
  )
}
function Card({ r, onGo, saved, onSave }: { r: any; onGo: (r: any) => void; saved: boolean; onSave: (e: React.MouseEvent, r: any) => void }) {
  const d = r.official_difficulty ? DIFF[r.official_difficulty] : null
  return (
    <button onClick={() => onGo(r)} style={{ display: 'block', width: '100%', textAlign: 'left', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', cursor: 'pointer', fontFamily: 'inherit', background: 'var(--surface)', padding: 0 }}>
      <div style={{ height: 90, backgroundImage: r.cover_image_url ? `url(${r.cover_image_url})` : 'linear-gradient(135deg, var(--accent), #ff8fb1)', backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', alignItems: 'flex-end', padding: 10, position: 'relative' }}>
        {d && <span style={{ background: 'rgba(255,255,255,.9)', color: d.c, fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 9999 }}>{d.l}</span>}
        <span onClick={(e) => onSave(e, r)} style={{ position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: 9999, background: 'rgba(0,0,0,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><HeartIcon size={16} filled={saved} color={saved ? 'var(--accent)' : '#fff'} /></span>
      </div>
      <div style={{ padding: '10px 12px 12px' }}>
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><MaskIcon name="shop" size={13} />{r.route_shops?.length ?? 0}곳</span>
          {r.official_difficulty ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><MaskIcon name="clock" size={13} />{DIFF[r.official_difficulty]?.l ?? ''}</span> : null}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><HeartIcon size={13} filled color="var(--accent)" />{r.likes ?? 0}</span>
        </div>
      </div>
    </button>
  )
}
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 16, background: 'var(--surface)' }}>
      <h3 style={{ fontSize: 14, fontWeight: 900, margin: '0 0 8px' }}>{title}</h3>
      {children}
    </div>
  )
}
function EmptyBox({ text }: { text: string }) {
  return <div style={{ padding: '50px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}><div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center' }}><ColorIcon name="colormap" size={44} /></div>{text}</div>
}
