'use client'

/* 마이페이지 › 좋아요 작품 — 최애(❤)·관심(★)으로 담은 작품만 모아 보기.
   (예전엔 빠른 메뉴가 작품 화면(/my-works)으로 보냈다)
   데이터는 작품 화면과 같은 getMyWorkRelationships — 그중 최애·관심이 있는 것만. 누르면 작품 상세로. */
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { getMyWorkRelationships } from '@/services/workRelationshipService'
import ThumbImg from '@/components/common/ThumbImg'
import { EmptyState, LoadingState } from './SavedShopsTab'

type Filter = 'all' | 'favorite' | 'interest'
interface Liked { id: string; name: string; slug: string; coverUrl: string | null; tier: 'favorite' | 'interest' }

const HEART = <svg width="13" height="13" viewBox="0 0 24 24" fill="#FF6B6B" aria-hidden><path d="M12 20C5 15 3.5 10.5 5.5 7.8 7.1 5.9 10.2 6.1 12 8.4 13.8 6.1 16.9 5.9 18.5 7.8 20.5 10.5 19 15 12 20Z" /></svg>
const STAR = <svg width="13" height="13" viewBox="0 0 24 24" fill="#FFD166" stroke="#E9B72E" strokeWidth="1.5" strokeLinejoin="round" aria-hidden><path d="M12 4.5 14.2 9l5 .7-3.6 3.5.9 5-4.5-2.4L7.4 18l.9-5L4.7 9.7l5-.7z" /></svg>

export default function LikedWorksTab({ userId }: { userId: string }) {
  const [items, setItems] = useState<Liked[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')

  useEffect(() => {
    getMyWorkRelationships(userId)
      .then(rels => {
        const liked = rels
          .filter(r => r.affinity === 'favorite' || r.affinity === 'interest')
          .map(r => ({ id: r.work.id, name: r.work.name, slug: r.work.slug, coverUrl: r.work.coverUrl ?? null, tier: r.affinity as Liked['tier'] }))
          // 최애 먼저, 그 안에선 이름순
          .sort((a, b) => (a.tier === b.tier ? a.name.localeCompare(b.name, 'ko') : a.tier === 'favorite' ? -1 : 1))
        setItems(liked)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [userId])

  const counts = useMemo(() => ({
    all: items.length,
    favorite: items.filter(i => i.tier === 'favorite').length,
    interest: items.filter(i => i.tier === 'interest').length,
  }), [items])
  const shown = filter === 'all' ? items : items.filter(i => i.tier === filter)

  if (loading) return <LoadingState />
  if (items.length === 0) return <EmptyState icon="heart" text="좋아요한 작품이 없어요 — 작품 화면에서 최애·관심을 눌러 담아 보세요" />

  const chip = (key: Filter, label: string) => (
    <button
      key={key}
      type="button"
      onClick={() => setFilter(key)}
      aria-pressed={filter === key}
      style={{
        height: 34, padding: '0 14px', borderRadius: 9999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 800,
        border: `1px solid ${filter === key ? 'var(--accent)' : 'var(--border)'}`,
        background: filter === key ? 'var(--accent)' : 'var(--surface)',
        color: filter === key ? '#fff' : 'var(--text)',
      }}
    >
      {label} <span style={{ opacity: .75, fontWeight: 700 }}>{counts[key]}</span>
    </button>
  )

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {chip('all', '전체')}
        {chip('favorite', '최애')}
        {chip('interest', '관심')}
      </div>
      {shown.length === 0 ? (
        <EmptyState icon="heart" text={filter === 'favorite' ? '최애로 담은 작품이 없어요' : '관심으로 담은 작품이 없어요'} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 14 }}>
          {shown.map(w => (
            <Link key={w.id} href={`/work/${w.slug}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', background: 'var(--surface)' }}>
              <div style={{ position: 'relative', aspectRatio: '1 / 1', background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {w.coverUrl
                  ? <ThumbImg src={w.coverUrl} alt="" loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  : <span style={{ fontSize: 26, fontWeight: 900, color: 'var(--muted)', opacity: .5 }}>{w.name.slice(0, 2)}</span>}
                <span style={{ position: 'absolute', top: 8, left: 8, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 9999, background: 'rgba(255,255,255,.94)', boxShadow: '0 1px 3px rgba(0,0,0,.1)', fontSize: 11.5, fontWeight: 800, color: 'var(--text)' }}>
                  {w.tier === 'favorite' ? HEART : STAR}{w.tier === 'favorite' ? '최애' : '관심'}
                </span>
              </div>
              <div style={{ padding: '10px 12px 12px', fontSize: 14, fontWeight: 800, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.name}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
