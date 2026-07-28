'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { ROUTES } from '@/lib/constants/routes'
import { getWorkFanartHighlight, FanartHighlight } from '@/services/fanartService'
import type { CommunityPost } from '@/types/community-post'

// 왕관(트로피) 아이콘
function Trophy({ size = 18, color = '#F5B100' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
    </svg>
  )
}

export default function WorkFeaturedFanart({
  tagId,
  onOpenPost,
}: {
  tagId: string
  workName?: string
  onOpenPost: (p: CommunityPost) => void
}) {
  const { user } = useAuth()
  const router = useRouter()
  const [hl, setHl] = useState<FanartHighlight | null>(null)
  const [guide, setGuide] = useState(false)

  useEffect(() => {
    let alive = true
    getWorkFanartHighlight(tagId, user?.id).then(h => { if (alive) setHl(h) })
    return () => { alive = false }
  }, [tagId, user?.id])

  const goWrite = () =>
    user ? router.push(`/community/write?board=fanart&tag=${tagId}&lockTag=1`) : router.push(ROUTES.login)

  if (!hl) return null

  const isFeatured = hl.mode === 'featured'
  const post = hl.post
  const openPost = () => post && onOpenPost(isFeatured ? { ...post, featured: 'current' as const } : post)

  return (
    <div style={{ marginBottom: 24 }}>
      {/* 헤더 + 대표 선정 기준 도움말 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          {isFeatured && <Trophy />}
          <h3 style={{ fontSize: 16, fontWeight: 900, margin: 0 }}>이번 시즌 대표 팬아트</h3>
        </div>

        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setGuide(v => !v)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, color: 'var(--muted)', fontWeight: 700 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M9.6 9.2a2.4 2.4 0 0 1 4.5 1.1c0 1.6-2.1 2-2.1 3.2" /><path d="M12 17h.01" /></svg>
            대표 선정 기준
          </button>
          {guide && (
            <>
              <div onClick={() => setGuide(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
              <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', zIndex: 50, width: 244, padding: '13px 15px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 10px 30px rgba(0,0,0,.14)', fontSize: 12.5, lineHeight: 1.65, color: 'var(--text)' }}>
                대표 팬아트는 <b>2주마다 자동 선정</b>돼요.<br />
                좋아요 · 댓글 · 최근 활동 등을 종합해 정해집니다.
              </div>
            </>
          )}
        </div>
      </div>

      {/* Case 2 — 팬아트 없음 */}
      {hl.mode === 'empty' && (
        <div style={{ border: '1px dashed var(--border)', borderRadius: 18, padding: '38px 20px', textAlign: 'center', background: 'var(--surface2)' }}>
          <p style={{ margin: '0 0 6px', fontSize: 14.5, fontWeight: 800, color: 'var(--text)' }}>아직 등록된 팬아트가 없어요</p>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
            첫 번째 팬아트를 올려<br />이 작품의 대표 팬아트에 도전해 보세요!
          </p>
          <button onClick={goWrite} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 18px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            팬아트 등록
          </button>
        </div>
      )}

      {/* Case 1 — 대표 선정 전 안내 */}
      {hl.mode === 'popular' && (
        <div style={{ marginBottom: 12, padding: '11px 14px', borderRadius: 12, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
            <b style={{ color: 'var(--text)' }}>아직 이번 시즌 대표 팬아트가 선정되지 않았어요.</b><br />
            가장 인기 있는 팬아트를 먼저 만나보세요.
          </p>
        </div>
      )}

      {/* Case 1 & 3 — 이미지 카드 */}
      {post && (
        <>
          <div
            onClick={openPost}
            style={{ position: 'relative', borderRadius: 18, overflow: 'hidden', cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--surface2)' }}
          >
            {post.images[0] && <img src={post.images[0]} alt="" style={{ width: '100%', maxHeight: 420, objectFit: 'cover', display: 'block' }} />}
            {isFeatured && (
              <span style={{ position: 'absolute', top: 12, left: 12, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 9999, background: 'rgba(0,0,0,.55)', color: '#FFD84D', fontSize: 12, fontWeight: 800 }}>
                <Trophy size={13} color="#FFD84D" />
                시즌 대표
              </span>
            )}
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '28px 20px 16px', background: 'linear-gradient(0deg, rgba(0,0,0,.72), rgba(0,0,0,0))', color: '#fff' }}>
              {post.title && <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 3 }}>{post.title}</div>}
              <div style={{ fontSize: 13, opacity: 0.92 }}>by {post.author?.nickname ?? '익명'} · ♥ {post.likeCount}</div>
            </div>
          </div>

          {hl.mode === 'popular' && (
            <button
              onClick={openPost}
              style={{ marginTop: 10, width: '100%', padding: '11px', borderRadius: 10, border: '1.5px solid var(--accent)', background: 'var(--surface)', color: 'var(--accent)', fontWeight: 800, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              팬아트 보러가기
            </button>
          )}
        </>
      )}

      {/* 명예의 전당 진입 */}
      <div style={{ marginTop: 12, textAlign: 'center' }}>
        <Link href="/hall-of-fame" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 700, color: 'var(--muted)', textDecoration: 'none' }}>
          <Trophy size={13} color="var(--muted)" /> 명예의 전당 보기 ›
        </Link>
      </div>
    </div>
  )
}
