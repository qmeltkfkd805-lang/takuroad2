'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { getMyGoodsCounts } from '@/services/goodsService'
import { getExhibitCount } from '@/services/exhibitService'

/* 마이페이지 "나의 굿즈 보관함" 진입 배너 (활동 통계 아래, 주요 콘텐츠 영역).
   내 굿즈 / 작품별 컬렉션 / 전시관 개수 표시. PC·모바일 공용. */

const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

function IconGoods() {
  return <svg width="22" height="22" viewBox="0 0 24 24" {...P}><path d="M4 8h16l-1 12H5L4 8z" /><path d="M8 8V6a4 4 0 0 1 8 0v2" /></svg>
}
function IconCollection() {
  return <svg width="22" height="22" viewBox="0 0 24 24" {...P}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
}
function IconExhibit() {
  return <svg width="22" height="22" viewBox="0 0 24 24" {...P}><rect x="3" y="4" width="18" height="14" rx="2" /><path d="m7 14 3-3 3 3 2-2 2 2" /><path d="M9 22h6" /></svg>
}

export default function MyGoodsSection() {
  const router = useRouter()
  const [counts, setCounts] = useState<{ goodsCount: number; collectionCount: number } | null>(null)
  const [exhibitCount, setExhibitCount] = useState(0)

  useEffect(() => {
    let alive = true
    getMyGoodsCounts()
      .then(c => { if (alive) setCounts(c) })
      .catch(() => { if (alive) setCounts({ goodsCount: 0, collectionCount: 0 }) })
    getExhibitCount().then(n => { if (alive) setExhibitCount(n) }).catch(() => {})
    return () => { alive = false }
  }, [])

  const loading = counts === null
  const tiles: { key: string; label: string; value: number; icon: ReactNode; onClick: () => void; soon?: boolean }[] = [
    { key: 'goods', label: '내 굿즈', value: counts?.goodsCount ?? 0, icon: <IconGoods />, onClick: () => router.push('/profile/goods') },
    { key: 'coll', label: '작품별 컬렉션', value: counts?.collectionCount ?? 0, icon: <IconCollection />, onClick: () => router.push('/profile/collections') },
    { key: 'exhibit', label: '전시관', value: exhibitCount, icon: <IconExhibit />, onClick: () => router.push('/profile/exhibit') },
  ]

  return (
    <section
      style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
        padding: '18px 18px 16px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>나의 굿즈 보관함</span>
        <button
          onClick={() => router.push('/community/write?board=goods')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, border: 'none', cursor: 'pointer',
            background: 'var(--accent)', color: '#fff', fontFamily: 'inherit', fontSize: 13, fontWeight: 800,
            padding: '8px 14px', borderRadius: 9999,
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" {...P}><path d="M12 5v14M5 12h14" /></svg>
          굿즈 올리기
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {tiles.map(t => (
          <button
            key={t.key}
            onClick={t.soon ? undefined : t.onClick}
            disabled={!!t.soon}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10,
              padding: '16px 14px', borderRadius: 14, textAlign: 'left', fontFamily: 'inherit',
              border: '1px solid var(--border)', background: 'var(--surface2)',
              cursor: t.soon ? 'default' : 'pointer', opacity: t.soon ? 0.7 : 1,
            }}
          >
            <span style={{
              width: 40, height: 40, borderRadius: 11, flexShrink: 0,
              background: 'var(--accent-l)', color: 'var(--accent)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>{t.icon}</span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <span style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', display: 'flex', alignItems: 'baseline', gap: 6 }}>
                {loading && !t.soon ? '–' : t.value}
                {t.soon && <em style={{ fontSize: 11, fontWeight: 800, fontStyle: 'normal', color: 'var(--muted)' }}>준비 중</em>}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>{t.label}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
