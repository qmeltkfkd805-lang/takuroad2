'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/layout/AuthProvider'
import { ROUTES } from '@/lib/constants/routes'
import { UserAvatar } from '@/components/cosmetic/UserFace'
import { getFollowCounts, getFollowState, follow, unfollow } from '@/services/followService'
import { useIsDesktop } from '@/hooks/useIsDesktop'
import { getExhibits, type ExhibitCard } from '@/services/exhibitService'
import ExhibitLightbox from './ExhibitLightbox'
import styles from './Exhibit.module.css'

const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

interface Owner { id: string; nickname: string; avatar_url: string | null; bio: string | null; is_profile_public: boolean | null }

/* 공개 전시관 /exhibit/[nickname] — 프로필형 헤더 + 정사각 그리드. 로그인 게이트 없음(anon = public만). */
export default function ExhibitPublicPage({ nickname }: { nickname: string }) {
  const router = useRouter()
  const { user } = useAuth() as any
  const [owner, setOwner] = useState<Owner | null | 'notfound'>(null)
  const [cards, setCards] = useState<ExhibitCard[] | null>(null)
  const [count, setCount] = useState(0)
  const [follows, setFollows] = useState<{ followers: number; following: number }>({ followers: 0, following: 0 })
  const [following, setFollowing] = useState(false)
  const [followBusy, setFollowBusy] = useState(false)
  // 데스크톱에서만 라이트박스로 크게 보기. 모바일은 기존대로 상세 페이지로 이동.
  const isDesktop = useIsDesktop()
  const [lightbox, setLightbox] = useState<number | null>(null)

  // 1) 닉네임 → 프로필
  useEffect(() => {
    let alive = true
    const supabase = createClient()
    supabase.from('profiles').select('id, nickname, avatar_url, bio, is_profile_public').eq('nickname', nickname).maybeSingle()
      .then(({ data }) => { if (alive) setOwner((data as any) ?? 'notfound') })
    return () => { alive = false }
  }, [nickname])

  const isSelf = !!user && owner && owner !== 'notfound' && user.id === owner.id
  const hidden = owner && owner !== 'notfound' && owner.is_profile_public === false && !isSelf

  // 2) 소유자 확정 후 전시·팔로우 로드
  useEffect(() => {
    if (!owner || owner === 'notfound' || hidden) return
    const oid = owner.id
    getExhibits(oid).then(setCards).catch(() => setCards([]))
    getFollowCounts(oid).then(setFollows).catch(() => {})
    if (user && user.id !== oid) getFollowState(user.id, oid).then(s => setFollowing(s.following)).catch(() => {})
    // 전시 개수는 목록 길이로 대체 표시(권한 통과분)
  }, [owner, hidden, user])

  useEffect(() => { if (cards) setCount(cards.length) }, [cards])

  async function toggleFollow() {
    if (!user) { router.push(ROUTES.login); return }
    if (!owner || owner === 'notfound') return
    setFollowBusy(true)
    const willFollow = !following
    setFollowing(willFollow)
    setFollows(f => ({ ...f, followers: Math.max(0, f.followers + (willFollow ? 1 : -1)) }))
    const ok = willFollow ? await follow(user.id, owner.id) : await unfollow(user.id, owner.id)
    if (!ok) { setFollowing(!willFollow); setFollows(f => ({ ...f, followers: Math.max(0, f.followers + (willFollow ? -1 : 1)) })) }
    setFollowBusy(false)
  }

  async function onShare() {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    try {
      const nav = navigator as any
      if (nav.share) await nav.share({ title: `${nickname} 님의 굿즈 전시관`, url })
      else { await navigator.clipboard.writeText(url); window.alert('링크를 복사했어요') }
    } catch { /* 취소 */ }
  }

  if (owner === null) return <div style={{ padding: 56, textAlign: 'center', color: 'var(--muted)' }}>불러오는 중…</div>
  if (owner === 'notfound') return (
    <div style={{ padding: 56, textAlign: 'center', color: 'var(--muted)' }}>존재하지 않는 사용자예요.</div>
  )

  return (
    <div style={{ padding: '20px 20px 64px', maxWidth: 1180, margin: 0, minWidth: 0 }}>
      {/* 프로필형 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingBottom: 18, marginBottom: 14, borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <UserAvatar userId={owner.id} src={owner.avatar_url} name={owner.nickname} size={72} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)' }}>{owner.nickname}</span>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--muted)' }}>굿즈 전시관</span>
          </div>
          {owner.bio && <p style={{ fontSize: 13, color: 'var(--muted)', margin: '6px 0 0', lineHeight: 1.5 }}>{owner.bio}</p>}
          <div style={{ display: 'flex', gap: 18, marginTop: 8, fontSize: 13.5 }}>
            <span><b style={{ color: 'var(--text)' }}>{count}</b> <span style={{ color: 'var(--muted)' }}>전시</span></span>
            <span><b style={{ color: 'var(--text)' }}>{follows.followers}</b> <span style={{ color: 'var(--muted)' }}>팔로워</span></span>
            <span><b style={{ color: 'var(--text)' }}>{follows.following}</b> <span style={{ color: 'var(--muted)' }}>팔로잉</span></span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          {isSelf ? (
            <button onClick={() => router.push('/profile/exhibit/new')} style={btnPrimary}>굿즈 전시하기</button>
          ) : (
            <button onClick={toggleFollow} disabled={followBusy} style={following ? btnGhost : btnPrimary}>{following ? '팔로잉' : '팔로우'}</button>
          )}
          <button onClick={onShare} aria-label="공유" style={{ ...btnGhost, width: 44, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" {...P}><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5 8.6 10.5" /></svg>
          </button>
        </div>
      </div>

      {hidden ? (
        <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--muted)' }}>비공개 프로필이에요.</div>
      ) : cards === null ? (
        <div className={styles.grid}>{[0, 1, 2, 3, 4, 5].map(i => <div key={i} className={styles.cell} style={{ cursor: 'default' }} />)}</div>
      ) : cards.length === 0 ? (
        <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--muted)' }}>{isSelf ? '아직 전시한 굿즈가 없어요.' : '아직 공개된 전시가 없어요.'}</div>
      ) : (
        <div className={styles.grid}>
          {cards.map((c, i) => (
            <button key={c.id} className={styles.cell} onClick={() => isDesktop ? setLightbox(i) : router.push(`/exhibit/${encodeURIComponent(nickname)}/${c.id}`)} aria-label={c.caption || '전시'}>
              {c.coverUrl
                ? <img src={c.coverUrl} alt="" loading="lazy" />
                : <span className={styles.cellPh}><svg width="30" height="30" viewBox="0 0 24 24" {...P}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2" /><path d="m5 19 5-4 3 2 3-3 3 3" /></svg></span>}
              <span className={styles.badges}>
                {c.imageCount > 1 && <span className={styles.badge}><svg width="13" height="13" viewBox="0 0 24 24" {...P}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M4 16V6a2 2 0 0 1 2-2h10" /></svg></span>}
                {c.hasPost && <span className={styles.badge}><svg width="13" height="13" viewBox="0 0 24 24" {...P}><path d="M21 11.5a8.5 8.5 0 0 1-12.1 7.7L3 21l1.8-5.9A8.5 8.5 0 1 1 21 11.5z" /></svg></span>}
              </span>
            </button>
          ))}
        </div>
      )}

      {isDesktop && lightbox !== null && cards && cards.length > 0 && (
        <ExhibitLightbox cards={cards} index={lightbox} ownerName={owner.nickname}
          onIndex={setLightbox} onClose={() => setLightbox(null)} />
      )}
    </div>
  )
}

const btnPrimary: React.CSSProperties = { height: 40, padding: '0 18px', borderRadius: 9999, border: 'none', background: 'var(--accent)', color: '#fff', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 800, cursor: 'pointer' }
const btnGhost: React.CSSProperties = { height: 40, padding: '0 16px', borderRadius: 9999, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 800, cursor: 'pointer' }
