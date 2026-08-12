'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/layout/AuthProvider'
import { getAllTags } from '@/services/shopService'
import { getAffinitiesForTags } from '@/services/workRelationshipService'
import { WorkCard, WorkCardData } from '@/components/tds/WorkCard'
import { useIsDesktop } from '@/hooks/useIsDesktop'
import { IP_TYPES, normIpType, ipTypeList } from '@/lib/constants/ipType'

// 작품 홈 — 등록된 작품을 카드로 쭉.
//   최애 작품 → 관심 작품 → 나머지 등록 작품 순서.

type Work = { id: string; name: string; slug: string; cover_url?: string | null; banner_image?: string | null; english_name?: string | null; ip_type?: string | null; release_year?: number | null; genres?: any; description?: string | null }

// 장르 필터 표시 순서 (작품 등록 화면과 동일)
const GENRE_ORDER = ['액션', '격투', '판타지', '모험', '학원', '일상', '가족', 'SF', '추리', '퍼즐', '로맨스', 'BL', 'GL', '코미디', '스포츠', '음악', '아이돌', '요리', '호러', '드라마', '마법소녀', '소년물', '로봇/메카', '19', '고어', '기타']
const genreList = (w: Work): string[] => Array.isArray(w.genres) ? w.genres.filter((g: any) => typeof g === 'string') : []

function completeness(w: Work): number {
  let n = 0
  if (w.cover_url) n += 4        // 이미지(대표) 최우선
  if (w.banner_image) n += 3     // 이미지(배너) 가중
  if (w.english_name) n++
  if (w.ip_type) n++
  if (w.release_year) n++
  if (w.description) n++
  if (w.genres && (Array.isArray(w.genres) ? w.genres.length > 0 : true)) n++
  return n
}

export default function MyWorksPage() {
  const isDesktop = useIsDesktop()
  const { user } = useAuth()
  const router = useRouter()
  const [works, setWorks] = useState<Work[]>([])
  const [affMap, setAffMap] = useState<Record<string, 'favorite' | 'interest'>>({})
  const [loading, setLoading] = useState(true)
  const favRowRef = useRef<HTMLDivElement>(null)
  const [favOverflow, setFavOverflow] = useState(false)
  const scrollFav = (dir: number) => favRowRef.current?.scrollBy({ left: dir * 480, behavior: 'smooth' })
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  const toggleGenre = (g: string) => setSelectedGenres(p => p.includes(g) ? p.filter(x => x !== g) : [...p, g])
  // 📱 모바일 그리드 전용 상태 (유형·연도 필터 + 정렬 + 드로어). PC는 selectedTypes/Years가 항상 비어 영향 없음
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [selectedYears, setSelectedYears] = useState<number[]>([])
  const toggleType = (t: string) => setSelectedTypes(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t])
  const [mFilterOpen, setMFilterOpen] = useState(false)
  const [mSort, setMSort] = useState<'complete' | 'name' | 'year'>('complete')
  const [mSortOpen, setMSortOpen] = useState(false)
  const [openSec, setOpenSec] = useState<string | null>('장르')
  const [filterOpen, setFilterOpen] = useState(false)
  const filterRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!filterOpen) return
    const onDoc = (e: MouseEvent) => { if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [filterOpen])

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

  // 화면에 존재하는 장르만 필터 칩으로 (등록 순서대로)
  const present = new Set(works.flatMap(genreList))
  // 유형 값(캐릭터·버튜버 등)은 장르에서 제외 — 이제 별도 '유형' 필터로 감
  const isType = (g: string) => (IP_TYPES as readonly string[]).includes(normIpType(g) ?? '')
  const availableGenres = [...GENRE_ORDER.filter(g => present.has(g)), ...[...present].filter(g => !GENRE_ORDER.includes(g))].filter(g => !isType(g))
  // 유형은 표준 라벨로 정리(anime/애니메이션 → 애니 등)해 중복 없이. 표준 순서 먼저, 그 외는 뒤에
  const normedTypes = [...new Set(works.flatMap(w => ipTypeList(w.ip_type)))]
  const availableTypes = [...IP_TYPES.filter(t => normedTypes.includes(t)), ...normedTypes.filter(t => !(IP_TYPES as readonly string[]).includes(t))]
  // 선택한 유형·장르를 "모두" 만족하는 작품만 (유형·장르 모두 every) + 연도 AND
  const filtered = works.filter(w =>
    (selectedGenres.length === 0 || selectedGenres.every(g => genreList(w).includes(g))) &&
    (selectedTypes.length === 0 || selectedTypes.every(t => ipTypeList(w.ip_type).includes(t))) &&
    (selectedYears.length === 0 || (!!w.release_year && selectedYears.includes(w.release_year)))
  )

  const favoritesCount = filtered.filter(w => affMap[w.id] === 'favorite').length
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

  const favorites = filtered.filter(w => affMap[w.id] === 'favorite')
  const interests = filtered.filter(w => affMap[w.id] === 'interest')
  // 최애도 관심도 아닌 나머지
  const others = filtered.filter(w => !affMap[w.id])

  const go = (wc: WorkCardData) => {
    const w = works.find(x => x.id === wc.id)
    if (w) router.push(`/work/${encodeURIComponent(w.slug || w.id)}`)
  }

  // 📱 모바일: 라프텔 스타일 — 최애 가로줄 + (총 N개·정렬·필터) + 2열 그리드. PC는 아래 기존 화면.
  if (!isDesktop) {
    const gridWorks = [...interests, ...others]
    const sortedGrid = [...gridWorks].sort((a, b) => {
      if (mSort === 'name') return a.name.localeCompare(b.name, 'ko')
      if (mSort === 'year') return (b.release_year ?? 0) - (a.release_year ?? 0) || a.name.localeCompare(b.name, 'ko')
      // 추천순 = 완성도(이미지 우선) 높은 순
      return completeness(b) - completeness(a) || a.name.localeCompare(b.name, 'ko')
    })
    const activeFilters = selectedGenres.length + selectedTypes.length + selectedYears.length
    return (
      <div style={{ background: 'var(--bg)', minHeight: '100%', paddingBottom: 80 }}>
        <style>{`.taku-noscroll::-webkit-scrollbar{display:none}.taku-noscroll{scrollbar-width:none;-ms-overflow-style:none}`}</style>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 10px', gap: 12 }}>
          <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>작품</h1>
          <Link href="/work/new" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '9px 14px', borderRadius: 10, background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 13.5, textDecoration: 'none' }}>+ 작품 등록</Link>
        </div>

        {loading ? (
          <p style={{ color: 'var(--muted)', padding: '32px 16px', textAlign: 'center' }}>불러오는 중…</p>
        ) : works.length === 0 ? (
          <div style={{ padding: '0 16px' }}>
            <EmptyBox title="아직 등록된 작품이 없어요" desc="첫 작품을 등록해보세요." action={<Link href="/work/new" style={primaryBtn}>작품 등록하기</Link>} />
          </div>
        ) : (
          <>
            {favorites.length > 0 && (
              <section style={{ marginBottom: 6 }}>
                <h2 style={{ fontSize: 16, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 7, padding: '4px 16px 10px', margin: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#FF6B6B" stroke="#FF6B6B" strokeWidth="2" strokeLinejoin="round"><path d="M12 20C5 15 3.5 10.5 5.5 7.8 7.1 5.9 10.2 6.1 12 8.4 13.8 6.1 16.9 5.9 18.5 7.8 20.5 10.5 19 15 12 20Z" /></svg>
                  최애 작품
                </h2>
                <div className="taku-noscroll" style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '0 16px 4px' }}>
                  {favorites.map(w => (
                    <div key={w.id} style={{ flex: '0 0 150px' }}>
                      <GridCard w={w} affinity={affMap[w.id]} onClick={() => go(toCard(w))} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 10px', gap: 10 }}>
              <span style={{ fontSize: 14, color: 'var(--muted)' }}>총 <b style={{ color: 'var(--text)', fontWeight: 900 }}>{sortedGrid.length}</b>개</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ position: 'relative' }}>
                  <button onClick={() => setMSortOpen(o => !o)} style={pillBtn}>{mSort === 'year' ? '연도순' : mSort === 'name' ? '이름순' : '추천순'} ▾</button>
                  {mSortOpen && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 40, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.16)', overflow: 'hidden', minWidth: 120 }}>
                      {([['complete', '추천순'], ['name', '이름순'], ['year', '연도순']] as const).map(([v, l]) => (
                        <button key={v} onClick={() => { setMSort(v); setMSortOpen(false) }} style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: mSort === v ? 'var(--surface2)' : 'none', color: 'var(--text)', padding: '11px 14px', fontSize: 14, fontWeight: mSort === v ? 800 : 600, cursor: 'pointer', fontFamily: 'inherit' }}>{l}</button>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={() => setMFilterOpen(true)} style={{ ...pillBtn, ...(activeFilters ? { border: '1px solid var(--accent)', color: 'var(--accent)' } : {}) }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 3H2l8 9.46V19l4 2v-8.54z" /></svg>
                  필터{activeFilters > 0 ? ` ${activeFilters}` : ''}
                </button>
              </div>
            </div>

            {sortedGrid.length === 0 ? (
              <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>조건에 맞는 작품이 없어요.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px 12px', padding: '4px 16px' }}>
                {sortedGrid.map(w => <GridCard key={w.id} w={w} affinity={affMap[w.id]} onClick={() => go(toCard(w))} />)}
              </div>
            )}
          </>
        )}

        {/* 필터 드로어 */}
        {mFilterOpen && typeof document !== 'undefined' && createPortal(
          <div onClick={() => setMFilterOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.45)' }}>
            <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '84%', maxWidth: 340, background: 'var(--surface)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 17, fontWeight: 900 }}>필터</span>
                <button onClick={() => { setSelectedGenres([]); setSelectedTypes([]); setSelectedYears([]) }} style={{ border: 'none', background: 'none', color: 'var(--muted)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>초기화</button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                <FilterSection label="장르" open={openSec === '장르'} onToggle={() => setOpenSec(s => s === '장르' ? null : '장르')}>
                  {availableGenres.map(g => <ChipToggle key={g} label={g} on={selectedGenres.includes(g)} onClick={() => toggleGenre(g)} />)}
                  {availableGenres.length === 0 && <span style={{ fontSize: 13, color: 'var(--muted)' }}>없음</span>}
                </FilterSection>
                {availableTypes.length > 0 && (
                  <FilterSection label="유형" open={openSec === '유형'} onToggle={() => setOpenSec(s => s === '유형' ? null : '유형')}>
                    {availableTypes.map(t => <ChipToggle key={t} label={t} on={selectedTypes.includes(t)} onClick={() => toggleType(t)} />)}
                  </FilterSection>
                )}
              </div>
              <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
                <button onClick={() => setMFilterOpen(false)} style={{ width: '100%', border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 15, padding: '13px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit' }}>{filtered.length}개 작품 보기</button>
              </div>
            </div>
          </div>,
          document.body,
        )}
      </div>
    )
  }

  return (
    <div style={{ padding: isDesktop ? '28px 32px 72px' : '20px 16px 72px' }}>
      <style>{`.taku-noscroll::-webkit-scrollbar{display:none}.taku-noscroll{scrollbar-width:none;-ms-overflow-style:none}`}</style>
            <div style={{ display: 'flex', flexDirection: isDesktop ? 'row' : 'column', alignItems: isDesktop ? 'flex-start' : 'stretch', justifyContent: 'space-between', gap: isDesktop ? 16 : 14, marginBottom: 24 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 6 }}>작품</h1>
          <p style={{ fontSize: 14.5, color: 'var(--muted)' }}>최애 작품을 제일 위에서 바로 만나보세요.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {/* 필터 — 유형·장르로 선택 (장르는 모두 포함, 유형은 하나라도 일치) */}
          {(!loading && works.length > 0 && (availableGenres.length > 0 || availableTypes.length > 0)) && (
          <div ref={filterRef} style={{ position: 'relative' }}>
          <button onClick={() => setFilterOpen(o => !o)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
              border: `1.5px solid ${(selectedGenres.length + selectedTypes.length) ? 'var(--accent)' : 'var(--border)'}`,
              background: (selectedGenres.length + selectedTypes.length) ? 'var(--accent-l, rgba(232,0,111,.08))' : 'var(--surface)',
              color: (selectedGenres.length + selectedTypes.length) ? 'var(--accent)' : 'var(--text)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 3H2l8 9.46V19l4 2v-8.54z" /></svg>
            필터
            {(selectedGenres.length + selectedTypes.length) > 0 && (
              <span style={{ background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 800, borderRadius: 9999, minWidth: 18, height: 18, padding: '0 5px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{selectedGenres.length + selectedTypes.length}</span>
            )}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: filterOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}><path d="m6 9 6 6 6-6" /></svg>
          </button>

          {filterOpen && (
            <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 40, width: 340, maxWidth: '92vw', maxHeight: '70vh', overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: '0 12px 32px rgba(0,0,0,.16)', padding: 14 }}>
              {availableTypes.length > 0 && (
                <>
                  <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 800, marginBottom: 8 }}>유형</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                    {availableTypes.map(t => {
                      const on = selectedTypes.includes(t)
                      return (
                        <button key={t} onClick={() => toggleType(t)}
                          style={{ padding: '7px 13px', borderRadius: 9999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                            border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'var(--accent)' : 'var(--surface)', color: on ? '#fff' : 'var(--text)' }}>
                          {on && '✓ '}{t}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
              <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 800, marginBottom: 8 }}>장르</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {availableGenres.map(g => {
                  const on = selectedGenres.includes(g)
                  return (
                    <button key={g} onClick={() => toggleGenre(g)}
                      style={{ padding: '7px 13px', borderRadius: 9999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                        border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'var(--accent)' : 'var(--surface)', color: on ? '#fff' : 'var(--text)' }}>
                      {on && '✓ '}{g}
                    </button>
                  )
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <button onClick={() => { setSelectedGenres([]); setSelectedTypes([]) }} disabled={selectedGenres.length + selectedTypes.length === 0}
                  style={{ border: 'none', background: 'none', cursor: (selectedGenres.length + selectedTypes.length) ? 'pointer' : 'default', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: (selectedGenres.length + selectedTypes.length) ? 'var(--muted)' : 'var(--border)', textDecoration: 'underline' }}>
                  초기화
                </button>
                <button onClick={() => setFilterOpen(false)}
                  style={{ border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 800, padding: '8px 16px', borderRadius: 10 }}>
                  {filtered.length}개 보기
                </button>
              </div>
            </div>
          )}
          </div>
          )}
          <Link href="/work/new" style={{ ...primaryBtn, flexShrink: 0 }}>+ 작품 등록하기</Link>
        </div>
      </div>

      {!loading && works.length > 0 && (selectedGenres.length + selectedTypes.length) > 0 && (
        <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 22px' }}>필터 적용 · {filtered.length}개</p>
      )}

      {loading ? (
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>불러오는 중…</p>
      ) : works.length === 0 ? (
        <EmptyBox
          title="아직 등록된 작품이 없어요"
          desc="첫 작품을 등록해보세요."
          action={<Link href="/work/new" style={primaryBtn}>작품 등록하기</Link>}
        />
      ) : filtered.length === 0 ? (
        <EmptyBox
          title="조건에 맞는 작품이 없어요"
          desc="선택한 필터에 맞는 작품이 없어요. 필터를 바꿔보세요."
          action={<button onClick={() => { setSelectedGenres([]); setSelectedTypes([]) }} style={{ ...primaryBtn, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>필터 초기화</button>}
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

          {others.length > 0 && (
            <Section title="등록 작품">
              <Grid>
                {others.map(w => (
                  <WorkCard key={w.id} work={toCard(w)} onClick={go} />
                ))}
              </Grid>
            </Section>
          )}
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

/* ── 📱 모바일 그리드 전용 ── */
const pillBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 13px', borderRadius: 9999,
  border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)',
  fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
}

function GridCard({ w, affinity, onClick }: { w: Work; affinity?: 'favorite' | 'interest' | null; onClick: () => void }) {
  const img = w.banner_image || w.cover_url
  return (
    <button onClick={onClick} style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit' }}>
      <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 10', borderRadius: 12, overflow: 'hidden', background: 'var(--surface2)' }}>
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="m4 16 4.5-4.5 3 3L16 10l4 5" /><circle cx="8.5" cy="9" r="1.5" /></svg>
          </div>
        )}
        {affinity && (
          <span style={{ position: 'absolute', top: 8, left: 8, width: 26, height: 26, borderRadius: 9999, background: 'rgba(255,255,255,.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,.15)' }}>
            {affinity === 'favorite'
              ? <svg width="14" height="14" viewBox="0 0 24 24" fill="#FF5692" stroke="none"><path d="M12 21s-7.5-4.6-10-9.2A5.4 5.4 0 0 1 12 6a5.4 5.4 0 0 1 10 5.8C19.5 16.4 12 21 12 21z" /></svg>
              : <svg width="15" height="15" viewBox="0 0 24 24" fill="#F5B100" stroke="none"><path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17.8 6.8 19.2l1-5.8L3.5 9.2l5.9-.9z" /></svg>}
          </span>
        )}
      </div>
      <div style={{ marginTop: 7, fontSize: 14, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{w.name}</div>
    </button>
  )
}

function FilterSection({ label, open, onToggle, children }: { label: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <button onClick={onToggle} style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', border: 'none', background: 'none', padding: '16px 18px', fontSize: 15, fontWeight: 800, color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit' }}>
        {label}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '0 18px 18px' }}>{children}</div>}
    </div>
  )
}

function ChipToggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ padding: '7px 13px', borderRadius: 9999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'var(--accent)' : 'var(--surface)', color: on ? '#fff' : 'var(--text)' }}>{on && '✓ '}{label}</button>
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
