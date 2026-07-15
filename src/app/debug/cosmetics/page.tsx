'use client'

/**
 * 진단 페이지 — /debug/cosmetics
 *
 * ⭐ 코스메틱 36개, 배지 32개를 전부 늘어놓는다.
 *    "어떤 게 안 보이는지"를 눈으로 찾기 위한 화면이다.
 *    실제 렌더링 코드(bgStyle·FRAME_STYLE·fxClass)를 그대로 쓴다 —
 *    여기서 안 보이면 진짜로 안 보이는 것이다.
 */

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FRAME_STYLE, bgStyle, fxClass, RARITY_LABEL } from '@/lib/cosmetics/style'

type Cos = {
  id: string; type: string; slug: string; name: string
  rarity: string; asset_url: string | null; is_default: boolean
}
type Tier = {
  id: string; tier_type: string; name: string; rarity: string
  icon_url: string | null; condition_target: any
  badges: { name: string; icon_url: string | null } | null
  reward: { name: string; type: string; slug: string } | null
}

export default function DebugCosmeticsPage() {
  const [cos, setCos] = useState<Cos[]>([])
  const [tiers, setTiers] = useState<Tier[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const sb = createClient()
      const [{ data: c }, { data: t }] = await Promise.all([
        sb.from('cosmetics').select('*').order('type').order('sort_order'),
        sb.from('badge_tiers')
          .select('id, tier_type, name, rarity, icon_url, condition_target, sort_order, badges!inner(name, icon_url, sort_order, group_id), reward:cosmetics!reward_cosmetic_id(name, type, slug)')
          .order('sort_order'),
      ])
      setCos((c ?? []) as any)
      setTiers((t ?? []) as any)
      setLoading(false)
    })()
  }, [])

  if (loading) return <div style={{ padding: 40 }}>불러오는 중…</div>

  const byType = (ty: string) => cos.filter(c => c.type === ty)
  const S: any = {
    page: { maxWidth: 1400, margin: '0 auto', padding: '32px 24px 80px' },
    h1: { fontSize: 30, fontWeight: 900, marginBottom: 6 },
    sub: { color: 'var(--muted)', marginBottom: 32, fontSize: 14 },
    h2: { fontSize: 21, fontWeight: 900, margin: '40px 0 16px', paddingBottom: 8, borderBottom: '2px solid var(--border)' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16 },
    card: { border: '1px solid var(--border)', borderRadius: 14, padding: 12, background: 'var(--surface)' },
    stage: { height: 110, borderRadius: 10, marginBottom: 10, position: 'relative', overflow: 'hidden',
             display: 'flex', alignItems: 'center', justifyContent: 'center' },
    dark: { background: 'linear-gradient(160deg,#241C2E,#3A2B47)' },
    light: { background: '#FFF6FA' },
    name: { fontSize: 13, fontWeight: 800 },
    meta: { fontSize: 11, color: 'var(--muted)', marginTop: 3, fontFamily: 'monospace' },
    bad: { color: '#D92D20', fontWeight: 800, fontSize: 11, marginTop: 4 },
    ok: { color: '#12B886', fontWeight: 800, fontSize: 11, marginTop: 4 },
  }

  return (
    <div style={S.page}>
      <h1 style={S.h1}>코스메틱 · 배지 진단</h1>
      <p style={S.sub}>
        코스메틱 {cos.length}개 · 배지 단계 {tiers.length}개 —
        실제 렌더링 코드를 그대로 쓴다. 여기서 안 보이면 진짜 안 보이는 것이다.
      </p>

      {/* ── 배경 ── */}
      <h2 style={S.h2}>배경 ({byType('background').length})</h2>
      <div style={S.grid}>
        {byType('background').map(c => (
          <div key={c.id} style={S.card}>
            <div style={{ ...S.stage, ...bgStyle(c.slug, c.asset_url) }} />
            <div style={S.name}>{c.name}</div>
            <div style={S.meta}>{c.slug} · {RARITY_LABEL[c.rarity] ?? c.rarity}</div>
            {c.asset_url
              ? <div style={S.ok}>이미지 {c.asset_url}</div>
              : <div style={S.meta}>CSS 색</div>}
          </div>
        ))}
      </div>

      {/* ── 프레임 ── */}
      <h2 style={S.h2}>프레임 ({byType('frame').length})</h2>
      <div style={S.grid}>
        {byType('frame').map(c => (
          <div key={c.id} style={S.card}>
            <div style={{ ...S.stage, ...S.light }}>
              <div style={{
                width: 68, height: 68, borderRadius: '50%',
                background: '#EFEFF2', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontWeight: 900, color: '#999',
                ...(FRAME_STYLE[c.slug] ?? {}),
              }}>존</div>
            </div>
            <div style={S.name}>{c.name}</div>
            <div style={S.meta}>{c.slug} · {RARITY_LABEL[c.rarity] ?? c.rarity}</div>
            {FRAME_STYLE[c.slug]
              ? <div style={S.ok}>스타일 있음</div>
              : <div style={S.bad}>FRAME_STYLE에 없음!</div>}
          </div>
        ))}
      </div>

      {/* ── 효과 ── */}
      <h2 style={S.h2}>효과 ({byType('effect').length})</h2>
      <div style={S.grid}>
        {byType('effect').map(c => (
          <div key={c.id} style={S.card}>
            <div className={fxClass(c.slug)} style={{ ...S.stage, ...S.dark }}>
              <span style={{ color: 'rgba(255,255,255,.5)', fontSize: 11, zIndex: 2 }}>어두운 배경</span>
            </div>
            <div className={fxClass(c.slug)} style={{ ...S.stage, ...S.light, height: 70 }}>
              <span style={{ color: 'rgba(0,0,0,.35)', fontSize: 11, zIndex: 2 }}>밝은 배경</span>
            </div>
            <div style={S.name}>{c.name}</div>
            <div style={S.meta}>{c.slug} · {RARITY_LABEL[c.rarity] ?? c.rarity}</div>
            {fxClass(c.slug)
              ? <div style={S.ok}>{fxClass(c.slug)}</div>
              : <div style={S.bad}>fxClass가 빈 문자열!</div>}
          </div>
        ))}
      </div>

      {/* ── 칭호 ── */}
      <h2 style={S.h2}>칭호 ({byType('title').length})</h2>
      <div style={S.grid}>
        {byType('title').map(c => (
          <div key={c.id} style={S.card}>
            <div style={{ ...S.stage, ...S.light, height: 66 }}>
              <span style={{
                padding: '6px 14px', borderRadius: 999,
                background: 'rgba(255,255,255,.85)',
                border: '1px solid rgba(255,86,146,.3)',
                fontSize: 13, fontWeight: 800, color: 'var(--accent)',
              }}>{c.name}</span>
            </div>
            <div style={S.meta}>{c.slug} · {RARITY_LABEL[c.rarity] ?? c.rarity}</div>
          </div>
        ))}
      </div>

      {/* ── 배지 ── */}
      <h2 style={S.h2}>배지 단계 ({tiers.length})</h2>
      <div style={S.grid}>
        {tiers.map(t => (
          <div key={t.id} style={S.card}>
            <div style={{ ...S.stage, ...S.light }}>
              {t.icon_url
                ? <img src={t.icon_url} alt="" width={84} height={84}
                       style={{ objectFit: 'contain' }} />
                : <span style={{ fontSize: 11, color: '#D92D20' }}>아이콘 없음</span>}
            </div>
            <div style={S.name}>{t.name}</div>
            <div style={S.meta}>
              {t.badges?.name} · {t.tier_type} · {RARITY_LABEL[t.rarity] ?? t.rarity}
            </div>
            <div style={S.meta}>
              목표 {t.condition_target?.count}
              {t.condition_target?.distinct ? ` (${t.condition_target.distinct})` : ''}
            </div>
            {t.reward
              ? <div style={S.ok}>보상: {t.reward.name}</div>
              : <div style={S.bad}>보상 없음!</div>}
            <div style={S.meta}>{t.icon_url}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
