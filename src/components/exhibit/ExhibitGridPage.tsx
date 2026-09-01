'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import GoodsPageShell from '@/components/goods/GoodsPageShell'
import { useAuth } from '@/components/layout/AuthProvider'
import { UserAvatar } from '@/components/cosmetic/UserFace'
import { getFollowCounts } from '@/services/followService'
import { useIsDesktop } from '@/hooks/useIsDesktop'
import { getExhibits, getExhibitCount, type ExhibitCard } from '@/services/exhibitService'
import ExhibitLightbox from './ExhibitLightbox'
import styles from './Exhibit.module.css'

const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

/* 본인 전시관 (/profile/exhibit) — 프로필형 헤더 + 정사각 사진 그리드. 커버/우측 사이드바 없음. */
export default function ExhibitGridPage() {
  const router = useRouter()
  const { user, profile } = useAuth() as any
  const [cards, setCards] = useState<ExhibitCard[] | null>(null)
  const [error, setError] = useState(false)
  const [count, setCount] = useState(0)
  const [follow, setFollow] = useState<{ followers: number; following: number }>({ followers: 0, following: 0 })
  // 데스크톱에서만 라이트박스로 크게 보기. 모바일은 기존대로 상세 페이지로 이동.
  const isDesktop = useIsDesktop()
  const [lightbox, setLightbox] = useState<number | null>(null)

  useEffect(() => {
    if (!user) return
    getExhibits(user.id).then(setCards).catch(() => { setError(true); setCards([]) })
    getExhibitCount(user.id).then(setCount).catch(() => {})
    getFollowCounts(user.id).then(setFollow).catch(() => {})
  }, [user])

  const nickname = profile?.nickname ?? '나'

  const addBtn = (
    <button onClick={() => router.push('/profile/exhibit/new')} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#fff', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 800, padding: '9px 15px', borderRadius: 9999 }}>
      <svg width="15" height="15" viewBox="0 0 24 24" {...P}><path d="M12 5v14M5 12h14" /></svg>굿즈 전시하기
    </button>
  )

  return (
    <GoodsPageShell crumbs={[{ label: '마이', href: '/profile' }, { label: '전시관' }]} title="굿즈 전시관" right={addBtn}>
      {/* 프로필형 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '4px 0 18px', marginBottom: 14, borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <UserAvatar userId={user?.id} src={profile?.avatar_url} name={nickname} size={72} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)' }}>{nickname}</span>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--muted)' }}>굿즈 전시관</span>
          </div>
          <div style={{ display: 'flex', gap: 18, marginTop: 8, fontSize: 13.5 }}>
            <span><b style={{ color: 'var(--text)' }}>{count}</b> <span style={{ color: 'var(--muted)' }}>전시</span></span>
            <span><b style={{ color: 'var(--text)' }}>{follow.followers}</b> <span style={{ color: 'var(--muted)' }}>팔로워</span></span>
            <span><b style={{ color: 'var(--text)' }}>{follow.following}</b> <span style={{ color: 'var(--muted)' }}>팔로잉</span></span>
          </div>
        </div>
        <div className="gv-edit-desktop" style={{ marginLeft: 'auto' }}>{addBtn}</div>
      </div>

      {cards === null ? (
        <div className={styles.grid}>{[0, 1, 2, 3, 4, 5].map(i => <div key={i} className={styles.cell} style={{ cursor: 'default' }} />)}</div>
      ) : error ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>전시를 불러오지 못했어요.</div>
      ) : cards.length === 0 ? (
        <div style={{ padding: '48px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>아직 전시한 굿즈가 없어요</div>
          <p style={{ fontSize: 13.5, color: 'var(--muted)', margin: '0 0 16px', lineHeight: 1.6 }}>내 굿즈 중 자랑하고 싶은 걸 골라 전시관에 걸어보세요.</p>
          <button onClick={() => router.push('/profile/exhibit/new')} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 800, padding: '11px 18px', borderRadius: 9999 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" {...P}><path d="M12 5v14M5 12h14" /></svg>굿즈 전시하기
          </button>
        </div>
      ) : (
        <div className={styles.grid}>
          {cards.map((c, i) => (
            <button key={c.id} className={styles.cell} onClick={() => isDesktop ? setLightbox(i) : router.push(`/profile/exhibit/${c.id}`)} aria-label={c.caption || '전시'}>
              {c.coverUrl
                ? <img src={c.coverUrl} alt="" loading="lazy" />
                : <span className={styles.cellPh}><svg width="30" height="30" viewBox="0 0 24 24" {...P}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2" /><path d="m5 19 5-4 3 2 3-3 3 3" /></svg></span>}
              <span className={styles.badges}>
                {c.imageCount > 1 && (
                  <span className={styles.badge} title="여러 장"><svg width="13" height="13" viewBox="0 0 24 24" {...P}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M4 16V6a2 2 0 0 1 2-2h10" /></svg></span>
                )}
                {c.hasPost && (
                  <span className={styles.badge} title="굿즈 자랑 글 연결"><svg width="13" height="13" viewBox="0 0 24 24" {...P}><path d="M21 11.5a8.5 8.5 0 0 1-12.1 7.7L3 21l1.8-5.9A8.5 8.5 0 1 1 21 11.5z" /></svg></span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
      {isDesktop && lightbox !== null && cards && cards.length > 0 && (
        <ExhibitLightbox cards={cards} index={lightbox} ownerName={nickname}
          onIndex={setLightbox} onClose={() => setLightbox(null)} />
      )}
      <style>{`@media (max-width:768px){ .gv-edit-desktop{ display:none } }`}</style>
    </GoodsPageShell>
  )
}
