'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { getPublicRoutes, getMyRoutes, getMyRouteProgress } from '@/services/routeService'
import { formatDistance } from '@/hooks/useCurrentLocation'

type Tab = 'all' | 'official' | 'popular' | 'recent' | 'mine'
const TABS: { v: Tab; l: string }[] = [
  { v: 'all', l: '전체 루트' }, { v: 'official', l: '공식 루트' }, { v: 'popular', l: '인기 루트' }, { v: 'recent', l: '신규 루트' }, { v: 'mine', l: '내 루트' },
]
const DIFF: Record<number, { l: string; c: string }> = { 1: { l: '입문', c: '#22c55e' }, 2: { l: '하루', c: '#eab308' }, 3: { l: '빡셈', c: '#ef4444' } }
const SEASONS = [{ e: '🌸', l: '봄' }, { e: '🏖', l: '여름' }, { e: '🍁', l: '가을' }, { e: '❄️', l: '겨울' }]

const rtTags = (r: any): string[] => Array.from(new Set((r.route_shops ?? []).flatMap((rs: any) => (rs.shops?.shop_tags ?? []).map((st: any) => st.tags?.name).filter(Boolean))))
const rtRegions = (r: any): string[] => Array.from(new Set((r.route_shops ?? []).map((rs: any) => rs.shops?.region).filter(Boolean)))

export default function RouteExplorePage() {
  const router = useRouter()
  const { user } = useAuth()
  const [routes, setRoutes] = useState<any[]>([])
  const [mine, setMine] = useState<any[]>([])
  const [progress, setProgress] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    getPublicRoutes().then((d) => { setRoutes(d); setLoading(false) }).catch(() => setLoading(false))
  }, [])
  useEffect(() => {
    if (!user) return
    getMyRoutes(user.id).then(setMine).catch(() => {})
    getMyRouteProgress(user.id).then(setProgress).catch(() => {})
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
  const shown = q ? tabRoutes.filter((r) => (r.title ?? '').toLowerCase().includes(q)) : tabRoutes

  function go(r: any) { const t = r.share_token ?? r.shareToken; if (t) router.push(`/route/${t}`) }

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>루트 불러오는 중...</div>

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap', padding: 16 }}>
      {/* 메인 */}
      <div style={{ flex: '1 1 520px', minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>🗺️ 루트</h1>
          <button onClick={() => router.push('/route/new')} style={{ padding: '9px 16px', borderRadius: 9999, border: '1px solid var(--accent)', background: 'var(--surface)', color: 'var(--accent)', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>+ 루트 만들기</button>
        </div>

        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 16 }}>
          {TABS.map((t) => (
            <button key={t.v} onClick={() => setTab(t.v)} style={{ flexShrink: 0, padding: '8px 14px', borderRadius: 9999, border: 'none', background: tab === t.v ? 'var(--accent)' : 'var(--surface2)', color: tab === t.v ? '#fff' : 'var(--text)', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>{t.l}</button>
          ))}
        </div>

        {tab === 'all' && hero && (
          <button onClick={() => go(hero)} style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0, borderRadius: 16, overflow: 'hidden', marginBottom: 22 }}>
            <div style={{ backgroundImage: hero.cover_image_url ? `linear-gradient(to top, rgba(0,0,0,.55), rgba(0,0,0,.15)), url(${hero.cover_image_url})` : 'linear-gradient(135deg, var(--accent), #ff8fb1)', backgroundSize: 'cover', backgroundPosition: 'center', padding: '30px 24px', color: '#fff' }}>
              <span style={{ background: 'rgba(0,0,0,.2)', fontSize: 12, fontWeight: 800, padding: '3px 10px', borderRadius: 9999 }}>공식 추천</span>
              <div style={{ fontSize: 26, fontWeight: 900, margin: '12px 0 6px' }}>{hero.title}</div>
              {hero.description && <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 14 }}>{hero.description}</div>}
              <div style={{ display: 'flex', gap: 18, fontSize: 14, fontWeight: 700 }}>
                <span>🏪 {hero.route_shops?.length ?? 0}곳</span>
                {hero.total_distance_m ? <span>🚶 {formatDistance(hero.total_distance_m)}</span> : null}
                {hero.total_duration_min ? <span>⏱ {hero.total_duration_min}분</span> : null}
                <span>❤️ {hero.likes ?? 0}</span>
              </div>
              <span style={{ marginTop: 16, display: 'inline-block', background: '#fff', color: 'var(--accent)', fontWeight: 800, fontSize: 14, padding: '9px 20px', borderRadius: 9999 }}>루트 보기 →</span>
            </div>
          </button>
        )}

        {tab === 'all' ? (
          <>
            {byTag.length > 0 && (
              <Section title="작품별 루트">
                {byTag.map(([t, n]) => <MiniCard key={t} label={t} sub={`루트 ${n}개`} onClick={() => setTab('all')} />)}
              </Section>
            )}
            {byRegion.length > 0 && (
              <Section title="지역별 루트">
                {byRegion.map(([r, n]) => <MiniCard key={r} label={`📍 ${r}`} sub={`루트 ${n}개`} onClick={() => setTab('all')} />)}
              </Section>
            )}
            <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', marginTop: 8 }}>시즌 추천 · 추천 테마 루트는 준비 중이에요.</p>
          </>
        ) : (
          <>
            {tab === 'mine' && !user ? (
              <EmptyBox text="로그인하면 내 루트를 볼 수 있어요" />
            ) : shown.length === 0 ? (
              <EmptyBox text="루트가 없어요" />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                {shown.map((r) => <Card key={r.id} r={r} onGo={go} />)}
              </div>
            )}
          </>
        )}
      </div>

      {/* 오른쪽 사이드 */}
      <aside style={{ flex: '1 1 300px', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Panel title="오늘의 인기 루트">
          {popular.slice(0, 5).map((r, i) => (
            <button key={r.id} onClick={() => go(r)} style={{ display: 'flex', gap: 10, alignItems: 'center', width: '100%', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', padding: '10px 0', cursor: 'pointer', fontFamily: 'inherit' }}>
              <span style={{ width: 22, height: 22, borderRadius: 6, background: i < 3 ? 'var(--accent)' : 'var(--surface2)', color: i < 3 ? '#fff' : 'var(--muted)', fontWeight: 800, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{r.route_shops?.length ?? 0}곳 · {r.total_duration_min ?? 0}분 · ❤️ {r.likes ?? 0}</div>
              </div>
            </button>
          ))}
          {popular.length === 0 && <p style={{ fontSize: 13, color: 'var(--muted)', padding: '10px 0' }}>아직 루트가 없어요</p>}
        </Panel>

        <Panel title="시즌 추천 루트">
          <div style={{ display: 'flex', gap: 8, justifyContent: 'space-around', opacity: 0.5 }}>
            {SEASONS.map((s) => (
              <div key={s.l} style={{ textAlign: 'center' }}>
                <div style={{ width: 48, height: 48, borderRadius: 9999, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{s.e}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{s.l}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', marginTop: 10 }}>준비 중</p>
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
function MiniCard({ label, sub, onClick }: { label: string; sub: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ flexShrink: 0, width: 130, border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', cursor: 'pointer', fontFamily: 'inherit', background: 'var(--surface)', padding: 0, textAlign: 'left' }}>
      <div style={{ height: 80, background: 'linear-gradient(135deg, var(--accent), #ff8fb1)' }} />
      <div style={{ padding: '8px 10px 10px' }}>
        <div style={{ fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>
      </div>
    </button>
  )
}
function Card({ r, onGo }: { r: any; onGo: (r: any) => void }) {
  const d = r.official_difficulty ? DIFF[r.official_difficulty] : null
  return (
    <button onClick={() => onGo(r)} style={{ display: 'block', width: '100%', textAlign: 'left', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', cursor: 'pointer', fontFamily: 'inherit', background: 'var(--surface)', padding: 0 }}>
      <div style={{ height: 90, backgroundImage: r.cover_image_url ? `url(${r.cover_image_url})` : 'linear-gradient(135deg, var(--accent), #ff8fb1)', backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', alignItems: 'flex-end', padding: 10 }}>
        {d && <span style={{ background: 'rgba(255,255,255,.9)', color: d.c, fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 9999 }}>{d.l}</span>}
      </div>
      <div style={{ padding: '10px 12px 12px' }}>
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span>🏪 {r.route_shops?.length ?? 0}곳</span>
          {r.total_duration_min ? <span>⏱ {r.total_duration_min}분</span> : null}
          <span>❤️ {r.likes ?? 0}</span>
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
  return <div style={{ padding: '50px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}><div style={{ fontSize: 36, marginBottom: 10 }}>🗺️</div>{text}</div>
}
