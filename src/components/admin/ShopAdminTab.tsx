'use client'
import { useState, useEffect, useMemo, CSSProperties } from 'react'
import Link from 'next/link'
import { getShops } from '@/services/shopService'
import { getAdminStats, AdminStats } from '@/services/adminDashboardService'
import { Shop } from '@/types/shop'
import { SHOP_STATUS_LABEL } from '@/lib/constants/categories'
import { quickCompleteness } from '@/lib/shop/quickCompleteness'

const STATUS_TONE: Record<string, string> = {
  active: 'var(--green)', temporary_closed: 'var(--yellow)', closed: 'var(--red)', hidden: 'var(--muted)', pending: 'var(--muted)',
}
const FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'active', label: '운영중' },
  { value: 'temporary_closed', label: '임시휴업' },
  { value: 'closed', label: '폐업' },
]

function pct(p: number): string { return p >= 80 ? 'var(--green)' : p >= 50 ? 'var(--secondary)' : 'var(--red)' }

export default function ShopAdminTab() {
  const [shops, setShops] = useState<Shop[]>([])
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    Promise.all([getShops(), getAdminStats()]).then(([sh, st]) => {
      setShops(sh); setStats(st); setLoading(false)
    })
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return shops.filter((s) => {
      if (filter !== 'all' && s.status !== filter) return false
      if (!q) return true
      return s.name.toLowerCase().includes(q) || (s.region ?? '').toLowerCase().includes(q) || s.slug.toLowerCase().includes(q)
    })
  }, [shops, query, filter])

  async function copy(text: string, label: string) {
    try { await navigator.clipboard.writeText(text); alert(`${label} 복사됨`) } catch { alert('복사 실패') }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>불러오는 중...</div>

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 18 }}>
        <MiniStat label="총 샵" value={stats?.shopsTotal ?? shops.length} />
        <MiniStat label="운영중" value={stats?.shopsActive ?? 0} tone="var(--green)" />
        <MiniStat label="임시휴업" value={stats?.shopsTemp ?? 0} tone="var(--yellow)" />
        <MiniStat label="폐업" value={stats?.shopsClosed ?? 0} tone="var(--red)" />
        <MiniStat label="공식샵" value={stats?.shopsOfficial ?? 0} tone="var(--accent)" />
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="샵명 / 지역 / slug 검색"
        style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid var(--border)', fontFamily: 'inherit', fontSize: 14, marginBottom: 10, background: 'var(--surface)', color: 'var(--text)' }}
      />
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto' }}>
        {FILTERS.map((f) => (
          <button key={f.value} onClick={() => setFilter(f.value)} style={{
            flexShrink: 0, padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)',
            background: filter === f.value ? 'var(--accent)' : 'var(--surface)',
            color: filter === f.value ? '#fff' : 'var(--text)', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
          }}>{f.label}</button>
        ))}
      </div>

      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>{filtered.length}개 표시</p>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {filtered.map((s) => {
          const cp = quickCompleteness(s)
          const thumb = s.images?.[0]
          return (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 4px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: 44, height: 44, borderRadius: 8, flexShrink: 0, overflow: 'hidden', background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                {thumb ? <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🏪'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {s.name}
                  {s.is_verified && <span style={{ fontSize: 10, color: 'var(--accent)' }}>★</span>}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: STATUS_TONE[s.status] ?? 'var(--muted)', fontWeight: 700 }}>● {SHOP_STATUS_LABEL[s.status] ?? s.status}</span>
                  <span>·</span>
                  <span>{s.region ?? '지역 미정'}</span>
                  <span>·</span>
                  <span style={{ color: pct(cp.percent), fontWeight: 800 }}>{cp.percent}%</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <a href={`/shop/${s.slug}`} target="_blank" rel="noreferrer" title="사이트에서 보기" style={miniBtn}>🌐</a>
                <button onClick={() => copy(s.slug, 'slug')} title="slug 복사" style={miniBtn}>slug</button>
                <Link href={`/shop/${s.slug}/edit`} style={{ ...miniBtn, background: 'var(--accent)', color: '#fff', border: 'none', textDecoration: 'none' }}>수정</Link>
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div style={{ padding: '50px 20px', textAlign: 'center', color: 'var(--muted)' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🏪</div>
            <p style={{ fontSize: 14 }}>조건에 맞는 샵이 없어요</p>
          </div>
        )}
      </div>
    </div>
  )
}

const miniBtn: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)',
  background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, fontSize: 12,
  cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none',
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '10px 6px', textAlign: 'center' }}>
      <div style={{ fontSize: 18, fontWeight: 900, color: tone ?? 'var(--text)' }}>{value.toLocaleString()}</div>
      <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{label}</div>
    </div>
  )
}
