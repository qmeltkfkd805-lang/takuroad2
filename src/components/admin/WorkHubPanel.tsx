'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getShopsByTag } from '@/services/shopService'
import { getProductsByTag } from '@/services/shopProductService'
import { getEventsByTag } from '@/services/eventService'
import { getPublicRoutes } from '@/services/routeService'
import type { AdminTag } from '@/services/workAdminService'

const CHECKS: { key: keyof AdminTag; label: string }[] = [
  { key: 'cover_url', label: '포스터' }, { key: 'banner_image', label: '배너' },
  { key: 'description', label: '설명' }, { key: 'english_name', label: '영문명' },
  { key: 'ip_type', label: 'IP유형' }, { key: 'release_year', label: '발매연도' },
  { key: 'genres', label: '장르' },
]

function filled(t: AdminTag, k: keyof AdminTag): boolean {
  const v = t[k]
  if (Array.isArray(v)) return v.length > 0
  return v !== null && v !== undefined && v !== ''
}

export default function WorkHubPanel({ tag }: { tag: AdminTag }) {
  const [counts, setCounts] = useState<{ shops: number; goods: number; events: number; routes: number; favorites: number } | null>(null)

  useEffect(() => {
    let alive = true
    async function run() {
      const supabase = createClient()
      const [shops, goods, events, routes, favRes] = await Promise.all([
        getShopsByTag(tag.slug).then((r) => r?.length ?? 0).catch(() => 0),
        getProductsByTag(tag.id).then((r: any) => r?.length ?? 0).catch(() => 0),
        getEventsByTag(tag.id, 200).then((r) => r?.length ?? 0).catch(() => 0),
        getPublicRoutes({ tag: tag.name }).then((r: any) => r?.length ?? 0).catch(() => 0),
        supabase.from('user_favorite_tags').select('user_id', { count: 'exact', head: true }).eq('tag_id', tag.id),
      ])
      if (!alive) return
      setCounts({ shops, goods, events, routes, favorites: favRes.count ?? 0 })
    }
    run()
    return () => { alive = false }
  }, [tag.id, tag.slug, tag.name])

  const done = CHECKS.filter((c) => filled(tag, c.key)).length
  const pct = Math.round((done / CHECKS.length) * 100)
  const pctColor = pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--secondary)' : 'var(--red)'
  const hubHref = `/search?q=${encodeURIComponent(tag.name)}`

  const conn = [
    { label: '취급 샵', v: counts?.shops, href: hubHref },
    { label: '굿즈', v: counts?.goods, href: hubHref },
    { label: '이벤트', v: counts?.events, href: hubHref },
    { label: '루트', v: counts?.routes, href: hubHref },
    { label: '최애', v: counts?.favorites, href: hubHref },
  ]

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 16, marginBottom: 18, background: 'var(--surface2)' }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--muted)', marginBottom: 8 }}>연결 현황</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginBottom: 16 }}>
        {conn.map((c) => (
          <Link key={c.label} href={c.href} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '10px 4px', textAlign: 'center', textDecoration: 'none', background: 'var(--surface)' }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)' }}>{c.v == null ? '…' : c.v.toLocaleString()}</div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{c.label}</div>
          </Link>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--muted)' }}>데이터 완성도</span>
        <span style={{ fontSize: 15, fontWeight: 900, color: pctColor }}>{pct}%</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
        {CHECKS.map((c) => {
          const ok = filled(tag, c.key)
          return <span key={String(c.key)} style={{ fontSize: 12, fontWeight: 700, padding: '4px 9px', borderRadius: 9999, background: 'var(--surface)', color: ok ? 'var(--green)' : 'var(--muted)', border: `1px solid ${ok ? 'var(--green)' : 'var(--border)'}` }}>{ok ? '✓' : '○'} {c.label}</span>
        })}
      </div>

      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--muted)', marginBottom: 8 }}>빠른 이동</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Link href={`/work/${tag.slug}`} target="_blank" style={quick}>🌐 작품홈</Link>
        <Link href={hubHref} style={quick}>🔍 검색 결과</Link>
        <Link href="/map" style={quick}>🗺 지도</Link>
      </div>
    </div>
  )
}

const quick: React.CSSProperties = { padding: '8px 13px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, fontWeight: 700, textDecoration: 'none' }


