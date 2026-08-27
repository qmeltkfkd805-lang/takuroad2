'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/layout/AuthProvider'
import { getExhibitDetail, getExhibits, deleteExhibit, type ExhibitDetail, type ExhibitCard } from '@/services/exhibitService'
import { getGoodsPostId } from '@/services/goodsService'

const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
const VIS_LABEL: Record<string, string> = { public: '전체 공개', followers: '팔로워 공개', private: '나만 보기' }

type Owner = { nickname: string; avatar_url: string | null }

/* 전시 상세 = 인스타형 피드. 누른 전시를 맨 위로 정렬 → 아래로 스크롤하면 같은 사람의 전시글이 쭉 이어짐.
   각 글은 커버로 먼저 뜨고, 뷰포트에 들어오면 전체 이미지(가로 캐러셀)로 채워짐. 공개 열람 가능. */
export default function ExhibitDetailView({ id, homeHref = '/profile/exhibit' }: { id: string; homeHref?: string }) {
  const router = useRouter()
  const { user } = useAuth() as any
  const [state, setState] = useState<'loading' | 'ok' | 'notfound'>('loading')
  const [ownerId, setOwnerId] = useState<string | null>(null)
  const [owner, setOwner] = useState<Owner | null>(null)
  const [cards, setCards] = useState<ExhibitCard[]>([])
  const scrolledRef = useRef(false)

  // 1) 누른 전시 → ownerId 확보(권한 확인 겸)
  useEffect(() => {
    let alive = true
    setState('loading'); scrolledRef.current = false
    getExhibitDetail(id)
      .then(r => { if (!alive) return; if (r) { setOwnerId(r.ownerId); setState('ok') } else setState('notfound') })
      .catch(() => { if (alive) setState('notfound') })
    return () => { alive = false }
  }, [id])

  // 2) 소유자 프로필 + 같은 사람의 전시 목록
  useEffect(() => {
    if (!ownerId) return
    let alive = true
    const supabase = createClient()
    supabase.from('profiles').select('nickname, avatar_url').eq('id', ownerId).maybeSingle()
      .then(({ data }) => { if (alive && data) setOwner(data as any) })
    getExhibits(ownerId).then(list => {
      if (!alive) return
      // 누른 전시가 맨 위, 그다음 원래 순서(최신순) 유지
      const has = list.some(c => c.id === id)
      const ordered = has ? [...list.filter(c => c.id === id), ...list.filter(c => c.id !== id)] : list
      setCards(ordered)
    }).catch(() => setCards([]))
    return () => { alive = false }
  }, [ownerId, id])

  const isOwner = !!user && !!ownerId && user.id === ownerId

  function onDeleted(delId: string) {
    setCards(prev => {
      const next = prev.filter(c => c.id !== delId)
      if (next.length === 0) router.replace(homeHref)
      return next
    })
  }

  return (
    <div style={{ padding: '10px 12px 72px', maxWidth: 500, margin: '0 auto', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0 10px' }}>
        <button onClick={() => router.back()} aria-label="뒤로" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text)', display: 'flex', padding: 4, marginLeft: -4 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" {...P}><path d="m15 18-6-6 6-6" /></svg>
        </button>
        {owner?.nickname && (
          <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <button onClick={() => router.push(homeHref)} style={{ border: 'none', background: 'none', padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer' }}>{owner.nickname}</button>님의 전시관
          </span>
        )}
      </div>

      {state === 'loading' && <div style={{ padding: 56, textAlign: 'center', color: 'var(--muted)' }}>불러오는 중…</div>}
      {state === 'notfound' && (
        <div style={{ padding: 48, textAlign: 'center' }}>
          <p style={{ margin: '0 0 16px', color: 'var(--muted)' }}>전시를 찾을 수 없거나 볼 수 없는 전시예요.</p>
          <button onClick={() => router.push(homeHref)} style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>전시관으로</button>
        </div>
      )}

      {state === 'ok' && cards.map(card => (
        <div key={card.id} id={`ex-${card.id}`} style={{ marginBottom: 14 }}>
          <ExhibitFeedPost
            card={card}
            isOwner={isOwner}
            homeHref={homeHref}
            focus={card.id === id}
            onScrolled={() => { scrolledRef.current = true }}
            didScroll={scrolledRef}
            onDeleted={onDeleted}
          />
        </div>
      ))}
    </div>
  )
}

/* 피드 내 단일 전시 글 — 커버 우선 렌더 후 뷰포트 진입 시 전체 이미지 로드 */
function ExhibitFeedPost({
  card, isOwner, homeHref, focus, onScrolled, didScroll, onDeleted,
}: {
  card: ExhibitCard; isOwner: boolean; homeHref: string
  focus: boolean; onScrolled: () => void; didScroll: React.MutableRefObject<boolean>; onDeleted: (id: string) => void
}) {
  const router = useRouter()
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [detail, setDetail] = useState<ExhibitDetail | null>(null)
  const [menu, setMenu] = useState(false)
  const [busy, setBusy] = useState(false)

  // 뷰포트 근처에 오면 전체 상세 로드(1회)
  useEffect(() => {
    const el = wrapRef.current
    if (!el || detail) return
    let done = false
    const load = () => { if (done) return; done = true; getExhibitDetail(card.id).then(d => { if (d) setDetail(d) }).catch(() => {}) }
    if (typeof IntersectionObserver === 'undefined') { load(); return }
    const io = new IntersectionObserver(es => { es.forEach(e => { if (e.isIntersecting) { load(); io.disconnect() } }) }, { rootMargin: '600px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [card.id, detail])

  // 누른 글이면 최초 1회 맨 위로 스크롤
  useEffect(() => {
    if (!focus || didScroll.current) return
    const el = wrapRef.current
    if (el) { requestAnimationFrame(() => { el.scrollIntoView({ block: 'start' }); onScrolled() }) }
  }, [focus, didScroll, onScrolled])

  const images = detail ? detail.images : (card.coverUrl ? [card.coverUrl] : [])
  const caption = detail ? detail.caption : card.caption
  const goodsName = detail?.goodsName ?? null
  const goodsTypeName = detail?.goodsTypeName ?? card.goodsTypeName
  const postId = detail?.postId ?? null
  const visibility = detail?.visibility ?? card.visibility
  const workName = detail?.workName ?? card.workName

  async function onDelete() {
    setMenu(false)
    if (!window.confirm('이 전시를 내릴까요? 원본 굿즈는 그대로 남아요.')) return
    setBusy(true)
    try { await deleteExhibit(card.id); onDeleted(card.id) }
    catch (e: any) { window.alert(e?.message ?? '삭제에 실패했어요'); setBusy(false) }
  }
  // 수정 → 내 굿즈·작품 컬렉션과 동일: 연결된 굿즈 자랑 글 편집(없으면 굿즈 편집)
  async function onEdit() {
    setMenu(false)
    let gid = detail?.goodsItemId ?? null
    if (!gid) { try { const dd = await getExhibitDetail(card.id); if (dd) { setDetail(dd); gid = dd.goodsItemId } } catch { /* ignore */ } }
    if (gid) {
      try { const pid = await getGoodsPostId(gid); if (pid) { router.push(`/community/write?edit=${pid}`); return } } catch { /* fallback */ }
      router.push(`/community/write?goodsId=${gid}`); return   // 연결 글 없으면 기존 굿즈로 새 글 작성
    }
    router.push(`/profile/exhibit/${card.id}/edit`)   // goodsItemId 확보 실패 시에만(전시 자체 편집)
  }

  // 굿즈 정보만 수정(굿즈 편집 폼) — 별도 항목
  async function onEditGoodsInfo() {
    setMenu(false)
    let gid = detail?.goodsItemId ?? null
    if (!gid) { try { const dd = await getExhibitDetail(card.id); if (dd) { setDetail(dd); gid = dd.goodsItemId } } catch { /* ignore */ } }
    if (gid) router.push(`/profile/goods/${gid}/edit`)
  }

  async function onShare() {
    setMenu(false)
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const url = `${origin}${homeHref}/${card.id}`
    try {
      const nav = navigator as any
      if (nav.share) await nav.share({ title: caption || '굿즈 전시', url })
      else { await navigator.clipboard.writeText(url); window.alert('링크를 복사했어요') }
    } catch { /* 취소 */ }
  }

  return (
    <div ref={wrapRef} style={{ border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', background: 'var(--surface)' }}>
      {/* 헤더 — 작품 + 종류 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{workName ?? '작품 미지정'}</div>
          {goodsTypeName && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{goodsTypeName}</div>}
        </div>
        <div style={{ position: 'relative' }}>
          <button onClick={() => setMenu(m => !m)} aria-label="더보기" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text)', display: 'inline-flex', padding: 6 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" /></svg>
          </button>
          {menu && (
            <>
              <div onClick={() => setMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
              <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, minWidth: 160, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 8px 28px rgba(0,0,0,.18)', overflow: 'hidden', zIndex: 41 }}>
                {isOwner && (
                  <button onClick={onEdit} style={menuItem()}>
                    <svg width="16" height="16" viewBox="0 0 24 24" {...P}><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>수정
                  </button>
                )}
                {isOwner && (
                  <button onClick={onEditGoodsInfo} style={menuItem()}>
                    <svg width="16" height="16" viewBox="0 0 24 24" {...P}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2" /><path d="m5 19 5-4 3 2 3-3 3 3" /></svg>굿즈 정보 수정
                  </button>
                )}
                <button onClick={onShare} style={menuItem()}>
                  <svg width="16" height="16" viewBox="0 0 24 24" {...P}><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5 8.6 10.5" /></svg>공유
                </button>
                {isOwner && (
                  <button onClick={onDelete} disabled={busy} style={menuItem('#e5484d')}>
                    <svg width="16" height="16" viewBox="0 0 24 24" {...P}><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" /></svg>내리기
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 사진 — 가로 스와이프 캐러셀 */}
      <ExhibitCarousel images={images} moreHint={!detail && card.imageCount > 1 ? card.imageCount : 0} />

      {/* 본문 */}
      <div style={{ padding: '12px 14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          {goodsName && <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text)' }}>{goodsName}</span>}
          <span style={{ fontSize: 11.5, color: 'var(--muted)', marginLeft: 'auto' }}>{VIS_LABEL[visibility] ?? ''}</span>
        </div>
        {caption && (
          <p style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--text)', whiteSpace: 'pre-wrap', margin: '0 0 14px' }}>{caption}</p>
        )}
        {postId && (
          <button onClick={() => router.push(`/community/${postId}`)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 15px', borderRadius: 10, border: '1px solid var(--accent, #ff5692)', background: 'var(--surface)', color: 'var(--accent)', fontWeight: 800, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}>
            원본 굿즈 자랑 글 보기
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </button>
        )}
        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 14 }}>{fmtDate(card.createdAt)}</div>
      </div>
    </div>
  )
}

/* 가로 스와이프 이미지 캐러셀 — scroll-snap, 화살표·도트·카운터, contain(자르지 않음) */
function ExhibitCarousel({ images, moreHint = 0 }: { images: string[]; moreHint?: number }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [idx, setIdx] = useState(0)
  const [ratio, setRatio] = useState<number | null>(null)  // 첫 사진 가로/세로 비율
  const total = images.length
  function go(i: number) {
    const el = ref.current; if (!el) return
    const w = el.clientWidth
    el.scrollTo({ left: w * Math.max(0, Math.min(total - 1, i)), behavior: 'smooth' })
  }
  function onScroll() {
    const el = ref.current; if (!el) return
    const w = el.clientWidth || 1
    const n = Math.round(el.scrollLeft / w)
    if (n !== idx) setIdx(n)
  }
  function onFirstLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const im = e.currentTarget
    if (im.naturalWidth && im.naturalHeight) {
      const r = im.naturalWidth / im.naturalHeight
      setRatio(Math.max(0.8, Math.min(1.91, r)))   // 4:5 ~ 1.91:1로 제한
    }
  }
  if (total === 0) return <div style={{ aspectRatio: '1/1', background: 'var(--surface2)' }} />
  const frame = ratio ?? 1
  return (
    <div style={{ position: 'relative', background: 'var(--surface2)', aspectRatio: String(frame) }}>
      <div ref={ref} onScroll={onScroll} className="exCarScroll"
        style={{ display: 'flex', height: '100%', overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none' as any }}>
        {images.map((src, i) => (
          <div key={i} style={{ flex: '0 0 100%', height: '100%', scrollSnapAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={src} alt="" onLoad={i === 0 ? onFirstLoad : undefined} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
          </div>
        ))}
      </div>
      {total > 1 && (
        <>
          {idx > 0 && (
            <button onClick={() => go(idx - 1)} aria-label="이전" style={carBtn('left')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            </button>
          )}
          {idx < total - 1 && (
            <button onClick={() => go(idx + 1)} aria-label="다음" style={carBtn('right')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
            </button>
          )}
          <div style={{ position: 'absolute', top: 10, right: 12, background: 'rgba(0,0,0,.55)', color: '#fff', fontSize: 12, fontWeight: 800, padding: '2px 9px', borderRadius: 9999 }}>{idx + 1} / {total}</div>
          <div style={{ position: 'absolute', bottom: 10, left: 0, right: 0, display: 'flex', gap: 5, justifyContent: 'center' }}>
            {images.map((_, i) => (
              <span key={i} style={{ width: 6, height: 6, borderRadius: 9999, background: i === idx ? '#fff' : 'rgba(255,255,255,.5)', boxShadow: '0 0 2px rgba(0,0,0,.4)' }} />
            ))}
          </div>
        </>
      )}
      {total <= 1 && moreHint > 1 && (
        <div style={{ position: 'absolute', top: 10, right: 12, background: 'rgba(0,0,0,.55)', color: '#fff', fontSize: 12, fontWeight: 800, padding: '2px 9px', borderRadius: 9999, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M4 16V6a2 2 0 0 1 2-2h10" /></svg>{moreHint}
        </div>
      )}
      <style>{`.exCarScroll::-webkit-scrollbar{display:none}`}</style>
    </div>
  )
}
function carBtn(side: 'left' | 'right'): React.CSSProperties {
  return { position: 'absolute', top: '50%', transform: 'translateY(-50%)', [side]: 8, width: 34, height: 34, borderRadius: 9999, border: 'none', background: 'rgba(0,0,0,.42)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 } as React.CSSProperties
}
function menuItem(color?: string): React.CSSProperties {
  return { display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '11px 14px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, color: color ?? 'var(--text)', textAlign: 'left' }
}
function fmtDate(s?: string) {
  if (!s) return ''
  try { const d = new Date(s); return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}` } catch { return '' }
}
