'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/layout/AuthProvider'
import { getAllTags } from '@/services/shopService'
import { getAffinitiesForTags } from '@/services/workRelationshipService'
import { WorkCard, WorkCardData } from '@/components/tds/WorkCard'

// 작품 홈 — 등록된 작품을 카드로 쭉.
//   최애 작품 → 관심 작품 → 나머지 등록 작품 순서.

type Work = { id: string; name: string; slug: string; cover_url?: string | null; banner_image?: string | null; english_name?: string | null; ip_type?: string | null; release_year?: number | null; genres?: any; description?: string | null }

function completeness(w: Work): number {
  let n = 0
  if (w.cover_url) n++
  if (w.banner_image) n++
  if (w.english_name) n++
  if (w.ip_type) n++
  if (w.release_year) n++
  if (w.description) n++
  if (w.genres && (Array.isArray(w.genres) ? w.genres.length > 0 : true)) n++
  return n
}

export default function MyWorksPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [works, setWorks] = useState<Work[]>([])
  const [affMap, setAffMap] = useState<Record<string, 'favorite' | 'interest'>>({})
  const [loading, setLoading] = useState(true)
  const favRowRef = useRef<HTMLDivElement>(null)
  const [favOverflow, setFavOverflow] = useState(false)
  const scrollFav = (dir: number) => favRowRef.current?.scrollBy({ left: dir * 480, behavior: 'smooth' })

  useEffect(() => {
    setLoading(true)
    getAllTags()
      .then(async (all: any[]) => {
        setWorks([...(all as Work[])].sort((a, b) => {
          const d = completeness(b) - completeness(a)
          return d !== 0 ? d : a.name.localeCompare(b.name, 'ko')
        }))
        if (user && all.length) {
          const m = await getAffinitiesForTags(user.id, all.map(w => w.id))
          setAffMap(m as Record<string, 'favorite' | 'interest'>)
        } else {
          setAffMap({})
        }
      })
      .catch(() => setWorks([]))
      .finally(() => setLoading(false))
  }, [user])

  const favoritesCount = works.filter(w => affMap[w.id] === 'favorite').length
  useEffect(() => {
    const el = favRowRef.current
    if (!el) return
    const check = () => setFavOverflow(el.scrollWidth > el.clientWidth + 4)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [favoritesCount])

  const toCard = (w: Work): WorkCardData => ({
    id: w.id,
    name: w.name,
    coverUrl: w.cover_url ?? null,
    affinity: affMap[w.id] ?? null,
  })

  const favorites = works.filter(w => affMap[w.id] === 'favorite')
  const interests = works.filter(w => affMap[w.id] === 'interest')
  // 최애도 관심도 아닌 나머지
  const others = works.filter(w => !affMap[w.id])

  const go = (wc: WorkCardData) => {
    const w = works.find(x => x.id === wc.id)
    if (w) router.push(`/work/${encodeURIComponent(w.slug || w.id)}`)
  }

  return (
    <div style={{ padding: '28px 32px 72px' }}>
      <style>{`.taku-noscroll::-webkit-scrollbar{display:none}.taku-noscroll{scrollbar-width:none;-ms-overflow-style:none}`}</style>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 6 }}>작품</h1>
          <p style={{ fontSize: 14.5, color: 'var(--muted)' }}>최애 작품을 제일 위에서 바로 만나보세요.</p>
        </div>
        <Link href="/work/new" style={{ ...primaryBtn, flexShrink: 0 }}>+ 작품 등록하기</Link>
      </div>

      {loading ? (
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>불러오는 중…</p>
      ) : works.length === 0 ? (
        <EmptyBox
          title="아직 등록된 작품이 없어요"
          desc="첫 작품을 등록해보세요."
          action={<Link href="/work/new" style={primaryBtn}>작품 등록하기</Link>}
        />
      ) : (
        <>
          {favorites.length > 0 && (
            <section style={{ marginBottom: 36 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
                <h2 style={{ fontSize: 18, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#FF6B6B" stroke="#FF6B6B" strokeWidth="2" strokeLinejoin="round"><path d="M12 20C5 15 3.5 10.5 5.5 7.8 7.1 5.9 10.2 6.1 12 8.4 13.8 6.1 16.9 5.9 18.5 7.8 20.5 10.5 19 15 12 20Z" /></svg>
                  최애 작품
                </h2>
                {favOverflow && (
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button onClick={() => scrollFav(-1)} aria-label="이전" style={arrowBtn()}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                    </button>
                    <button onClick={() => scrollFav(1)} aria-label="다음" style={arrowBtn()}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                    </button>
                  </div>
                )}
              </div>
              <div ref={favRowRef} className="taku-noscroll" style={{ display: 'flex', gap: 20, overflowX: 'auto', scrollBehavior: 'smooth' }}>
                {favorites.map(w => (
                  <div key={w.id} style={{ flex: '0 0 240px' }}>
                    <WorkCard work={toCard(w)} onClick={go} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {interests.length > 0 && (
            <Section
              title="관심 작품"
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="#F5B100" stroke="none"><path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17.8 6.8 19.2l1-5.8L3.5 9.2l5.9-.9z" /></svg>}
            >
              <Grid>
                {interests.map(w => (
                  <WorkCard key={w.id} work={toCard(w)} onClick={go} />
                ))}
              </Grid>
            </Section>
          )}

          <Section title="등록 작품">
            <Grid>
              {others.map(w => (
                <WorkCard key={w.id} work={toCard(w)} onClick={go} />
              ))}
            </Grid>
          </Section>
        </>
      )}
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 36 }}>
      <h2 style={{ fontSize: 18, fontWeight: 900, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon}{title}
      </h2>
      {children}
    </section>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 20 }}>
      {children}
    </div>
  )
}

function EmptyBox({ title, desc, action }: { title: string; desc: string; action: React.ReactNode }) {
  return (
    <div style={{ border: '1px dashed var(--border)', borderRadius: 18, padding: '48px 24px', textAlign: 'center', background: 'var(--surface)' }}>
      <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 8 }}>{title}</div>
      <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 20 }}>{desc}</p>
      {action}
    </div>
  )
}

function arrowBtn(): React.CSSProperties {
  return {
    flexShrink: 0, width: 34, height: 34, borderRadius: 9999, border: '1px solid var(--border)',
    background: 'var(--surface)', boxShadow: '0 2px 8px rgba(0,0,0,.1)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)',
  }
}

const primaryBtn: React.CSSProperties = {
  display: 'inline-block', padding: '12px 22px', borderRadius: 12,
  background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 14.5,
  textDecoration: 'none',
}
