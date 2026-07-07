'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { ROUTES } from '@/lib/constants/routes'
import {
  togglePostLike, incrementPostView, getComments, addComment, deleteComment, toggleCommentLike,
  reportPost, hidePost, deletePost, setPostVisibility,
} from '@/services/communityPostService'
import { CommunityPost, PostComment, ReportReason, REPORT_REASONS, BOARD_LABEL, Poll } from '@/types/community-post'
import { getPollByPost, votePoll } from '@/services/pollService'

// ── 카드 ──
export function PostCard({ post, onOpen, showBoard }: { post: CommunityPost; onOpen: (p: CommunityPost) => void; showBoard?: boolean }) {
  const cover = post.images[0] ?? null
  return (
    <div onClick={() => onOpen(post)} style={{ border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', background: 'var(--surface)', cursor: 'pointer' }}>
      {cover ? (
        <div style={{ aspectRatio: '1 / 1', background: 'var(--surface2)', position: 'relative' }}>
          <img src={cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', filter: post.isSpoiler ? 'blur(12px)' : 'none' }} />
          {post.isSpoiler && <span style={{ position: 'absolute', top: 8, left: 8, fontSize: 11, fontWeight: 800, color: '#fff', background: '#e04343', padding: '2px 8px', borderRadius: 6 }}>스포주의</span>}
        </div>
      ) : (
        <div style={{ aspectRatio: '1 / 1', background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--border)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.6" /><path d="m21 15-5-5L5 21" /></svg>
        </div>
      )}
      <div style={{ padding: '10px 12px' }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
          {showBoard && <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)' }}>{BOARD_LABEL[post.board]}</span>}
          {post.work && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', background: 'var(--surface2)', padding: '2px 7px', borderRadius: 9999 }}>{post.work.name}</span>}
        </div>
        {post.title && <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.flair && <span style={flairBadge}>{post.flair}</span>}{post.isSpoiler && <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 800, color: '#fff', background: '#e04343', padding: '1px 6px', borderRadius: 5, marginRight: 5, verticalAlign: 'middle' }}>스포</span>}{post.title}</div>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)' }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.author?.nickname ?? '익명'}</span>
          <span style={{ display: 'inline-flex', gap: 8, flexShrink: 0 }}>
            <span>♥ {post.likeCount}</span>
            <span>💬 {post.commentCount}</span>
          </span>
        </div>
      </div>
    </div>
  )
}

// ── 상세 모달 ──
export function PostDetailModal({ post: initial, onClose, onChanged, variant = 'modal' }: { post: CommunityPost; onClose: () => void; onChanged?: () => void; variant?: 'modal' | 'page' }) {
  const { user, isAdmin } = useAuth()
  const router = useRouter()
  const [post, setPost] = useState(initial)
  const [imgIdx, setImgIdx] = useState(0)
  const [comments, setComments] = useState<PostComment[]>([])
  const [commentText, setCommentText] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [reporting, setReporting] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [poll, setPoll] = useState<Poll | null>(null)
  const loadPoll = useCallback(async () => { setPoll(await getPollByPost(post.id, user?.id)) }, [post.id, user?.id])
  useEffect(() => { loadPoll() }, [loadPoll])

  useEffect(() => { incrementPostView(post.id) }, [post.id])

  const loadComments = useCallback(async () => setComments(await getComments(post.id, user?.id)), [post.id, user?.id])
  useEffect(() => { loadComments() }, [loadComments])

  const like = async () => {
    if (!user) { router.push(ROUTES.login); return }
    const willLike = !post.likedByMe
    // 화면 그대로, 하트만 즉시 반영 (재조회 없음)
    setPost(p => ({ ...p, likedByMe: willLike, likeCount: Math.max(0, p.likeCount + (willLike ? 1 : -1)) }))
    await togglePostLike(post.id, user.id)
  }
  const share = async () => {
    const url = `${window.location.origin}/community/${post.id}`
    const title = post.title || '타쿠로드 게시글'
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      try { await (navigator as any).share({ title, text: title, url }) } catch { /* 취소 등 무시 */ }
      return
    }
    try { await navigator.clipboard.writeText(url); window.alert('공유를 지원하지 않는 환경이라 링크를 복사했어요.') } catch { window.prompt('링크 복사', url) }
  }
  const submitComment = async () => {
    if (!user) { router.push(ROUTES.login); return }
    if (!commentText.trim()) return
    const ok = await addComment(post.id, user.id, commentText, null)
    if (ok) { setCommentText(''); setPost(p => ({ ...p, commentCount: p.commentCount + 1 })); loadComments() }
  }
  const removeComment = async (id: string) => {
    if (!window.confirm('댓글을 삭제할까요?')) return
    await deleteComment(id); setPost(p => ({ ...p, commentCount: Math.max(0, p.commentCount - 1) })); loadComments()
  }
  const submitReply = async (parentId: string) => {
    if (!user) { router.push(ROUTES.login); return }
    if (!replyText.trim()) return
    const ok = await addComment(post.id, user.id, replyText, parentId)
    if (ok) { setReplyText(''); setReplyTo(null); setPost(p => ({ ...p, commentCount: p.commentCount + 1 })); loadComments() }
  }
  const likeComment = async (c: PostComment) => {
    if (!user) { router.push(ROUTES.login); return }
    const liked = !c.likedByMe
    setComments(cs => updateCommentLikeTree(cs, c.id, liked))
    await toggleCommentLike(c.id, user.id)
  }
  const onHide = async () => { if (window.confirm('이 글을 숨길까요?')) { await hidePost(post.id); onChanged?.(); onClose() } }
  const onDelete = async () => { if (window.confirm('이 글을 삭제할까요? 되돌릴 수 없어요.')) { await deletePost(post.id); onChanged?.(); onClose() } }

  const isAuthor = !!user && post.author?.id === user.id
  const togglePrivate = async () => {
    const to = post.visibility === 'private' ? 'public' : 'private'
    const ok = await setPostVisibility(post.id, to)
    if (ok) { setPost(p => ({ ...p, visibility: to })); onChanged?.() }
    setMenuOpen(false)
  }
  const images = post.images
  const html = post.content ?? ''
  const hasInlineImg = /<img/i.test(html)
  const isHtml = /<[a-z][\s\S]*>/i.test(html)
  const showCarousel = images.length > 0 && !hasInlineImg
  const isPage = variant === 'page'

  return (
    <div onClick={isPage ? undefined : onClose} style={isPage ? { width: '100%' } : { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 16 }}>
      <div onClick={isPage ? undefined : (e => e.stopPropagation())} style={isPage ? { width: '100%' } : { background: 'var(--surface)', borderRadius: 18, maxWidth: 560, width: '100%', maxHeight: '92vh', overflow: 'auto' }}>
        {isPage && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 0', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
            <button onClick={onClose} aria-label="뒤로" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text)', display: 'flex' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            </button>
            <span style={{ fontSize: 15, fontWeight: 800 }}>커뮤니티</span>
          </div>
        )}
        <style>{`.taku-post-body img{max-width:100%;border-radius:10px}.taku-post-body video{max-width:100%;border-radius:10px}.taku-post-body blockquote{border-left:3px solid var(--accent);margin:8px 0;padding:4px 14px;color:var(--muted)}.taku-post-body a{color:var(--accent)}`}</style>
        {showCarousel && (
          <div style={{ position: 'relative', background: '#000' }}>
            <img src={images[imgIdx]} alt="" style={{ width: '100%', maxHeight: '52vh', objectFit: 'contain', display: 'block' }} />
            {images.length > 1 && (
              <>
                <button onClick={() => setImgIdx(i => (i - 1 + images.length) % images.length)} style={navBtn('left')}>‹</button>
                <button onClick={() => setImgIdx(i => (i + 1) % images.length)} style={navBtn('right')}>›</button>
                <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, textAlign: 'center', color: '#fff', fontSize: 12 }}>{imgIdx + 1} / {images.length}</div>
              </>
            )}
          </div>
        )}
        <div style={{ padding: isPage ? '18px 0 24px' : '16px 18px 20px' }}>
          <div style={{ display: 'flex', gap: 7, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--accent)' }}>{BOARD_LABEL[post.board]}</span>
            {post.work && (
              <button onClick={() => post.work?.slug ? router.push(`/work/${encodeURIComponent(post.work.slug)}`) : router.push(`/work/${post.work?.id}`)} style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', background: 'var(--surface2)', border: 'none', padding: '3px 9px', borderRadius: 9999, cursor: 'pointer', fontFamily: 'inherit' }}>
                {post.work.name} ›
              </button>
            )}
            {isAuthor && (
              <div style={{ marginLeft: 'auto', position: 'relative' }}>
                <button onClick={() => setMenuOpen(o => !o)} aria-label="더보기" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, display: 'flex' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" /></svg>
                </button>
                {menuOpen && (
                  <div style={{ position: 'absolute', top: '100%', right: 0, zIndex: 30, marginTop: 4, minWidth: 140, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.14)', overflow: 'hidden' }}>
                    <button onClick={() => { setMenuOpen(false); router.push(`/community/write?edit=${post.id}`) }} style={menuItem}>수정하기</button>
                    <button onClick={togglePrivate} style={menuItem}>{post.visibility === 'private' ? '전체 공개' : '나만보기'}</button>
                    <button onClick={() => { setMenuOpen(false); onDelete() }} style={{ ...menuItem, color: '#e04343' }}>삭제하기</button>
                  </div>
                )}
              </div>
            )}
          </div>
          {post.title && <h3 style={{ fontSize: 19, fontWeight: 800, margin: '0 0 8px' }}>{post.flair && <span style={{ ...flairBadge, fontSize: 13 }}>{post.flair}</span>}{post.title}</h3>}
          <div style={{ fontSize: 12.5, color: 'var(--muted)', paddingBottom: 14, marginBottom: 16, borderBottom: '1px solid var(--border)' }}>{post.author?.nickname ?? '익명'} · 조회 {post.viewCount}</div>
          {post.content && (isHtml
            ? <div className="taku-post-body" style={{ fontSize: 14.5, lineHeight: 1.65, margin: '0 0 16px', wordBreak: 'break-word' }} dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.content) }} />
            : <p style={{ fontSize: 14.5, lineHeight: 1.65, whiteSpace: 'pre-wrap', margin: '0 0 16px' }}>{post.content}</p>)}

          {poll && <PollView poll={poll} userId={user?.id ?? null} onChanged={loadPoll} onRequireLogin={() => router.push(ROUTES.login)} />}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingBottom: 14, borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <button onClick={like} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: post.likedByMe ? '#FF4D6D' : 'var(--muted)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill={post.likedByMe ? '#FF4D6D' : 'none'} stroke={post.likedByMe ? '#FF4D6D' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" /></svg>
                좋아요 {post.likeCount}
              </button>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, color: 'var(--muted)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
                댓글 {post.commentCount}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={share} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, color: 'var(--muted)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" /><path d="M16 6l-4-4-4 4" /><path d="M12 2v13" /></svg>
                공유
              </button>
              {user && (
                <>
                  <span style={{ color: 'var(--border)' }}>|</span>
                  <button onClick={() => setReporting(true)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, color: 'var(--muted)' }}>신고</button>
                </>
              )}
            </div>
          </div>

          {/* 댓글 */}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 10 }}>댓글 {post.commentCount}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 14 }}>
              {comments.map(c => (
                <div key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <CommentRow c={c} user={user} isAdmin={isAdmin} onLike={likeComment} onReply={(id) => { setReplyTo(replyTo === id ? null : id); setReplyText('') }} onDelete={removeComment} />
                  {c.replies.map(r => (
                    <CommentRow key={r.id} c={r} isReply user={user} isAdmin={isAdmin} onLike={likeComment} onDelete={removeComment} />
                  ))}
                  {replyTo === c.id && user && (
                    <div style={{ display: 'flex', gap: 8, marginLeft: 28 }}>
                      <input value={replyText} onChange={e => setReplyText(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitReply(c.id)} placeholder="답글 달기" style={{ flex: 1, padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13.5, fontFamily: 'inherit' }} />
                      <button onClick={() => submitReply(c.id)} style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>등록</button>
                    </div>
                  )}
                </div>
              ))}
              {comments.length === 0 && <div style={{ fontSize: 13, color: 'var(--muted)' }}>첫 댓글을 남겨보세요.</div>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={commentText} onChange={e => setCommentText(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitComment()} placeholder="댓글 달기" style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit' }} />
              <button onClick={submitComment} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>등록</button>
            </div>
          </div>
        </div>
      </div>

      {reporting && <ReportModal postId={post.id} onClose={() => setReporting(false)} />}
    </div>
  )
}

// ── 신고 모달 ──
function ReportModal({ postId, onClose }: { postId: string; onClose: () => void }) {
  const { user } = useAuth()
  const [reason, setReason] = useState<ReportReason | ''>('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState<'ok' | 'duplicate' | null>(null)
  const canSubmit = !!reason && (reason !== 'etc' || content.trim().length > 0) && !saving

  const submit = async () => {
    if (!user || !reason) return
    setSaving(true)
    const r = await reportPost(postId, user.id, reason, content)
    setSaving(false)
    if (r === 'ok') setDone('ok'); else if (r === 'duplicate') setDone('duplicate'); else window.alert('신고에 실패했어요.')
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2200, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 18, maxWidth: 400, width: '100%', padding: '22px 22px 24px' }}>
        {done ? (
          <div style={{ textAlign: 'center' }}>
            <h3 style={{ fontSize: 17, fontWeight: 900, margin: '0 0 8px' }}>{done === 'ok' ? '신고가 접수되었어요' : '이미 신고한 글이에요'}</h3>
            <p style={{ fontSize: 14, color: 'var(--muted)', margin: '0 0 18px' }}>{done === 'ok' ? '운영팀이 확인할게요. 감사합니다.' : '같은 글은 한 번만 신고할 수 있어요.'}</p>
            <button onClick={onClose} style={{ width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>확인</button>
          </div>
        ) : (
          <>
            <h3 style={{ fontSize: 17, fontWeight: 900, margin: '0 0 10px' }}>신고</h3>
            <div style={{ fontSize: 12.5, color: '#c0392b', background: 'rgba(239,90,90,.08)', borderRadius: 10, padding: '9px 12px', marginBottom: 14, lineHeight: 1.5 }}>허위 신고가 반복될 경우 신고 기능이 제한될 수 있어요.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
              {REPORT_REASONS.map(r => (
                <label key={r.value} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 10px', borderRadius: 10, cursor: 'pointer', fontSize: 14, background: reason === r.value ? 'var(--accent-l, rgba(232,0,111,.07))' : 'transparent' }}>
                  <input type="radio" name="pr" checked={reason === r.value} onChange={() => setReason(r.value)} style={{ accentColor: 'var(--accent)' }} />{r.label}
                </label>
              ))}
            </div>
            {reason === 'etc' && <textarea value={content} onChange={e => setContent(e.target.value)} maxLength={300} rows={3} placeholder="신고 내용을 입력해주세요 (필수)" style={{ width: '100%', padding: '11px 13px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', marginBottom: 12, boxSizing: 'border-box', resize: 'vertical' }} />}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onClose} style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
              <button onClick={submit} disabled={!canSubmit} style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: canSubmit ? '#e04343' : 'var(--border)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: canSubmit ? 'pointer' : 'default', fontFamily: 'inherit' }}>{saving ? '접수 중…' : '신고하기'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function PollView({ poll, userId, onChanged, onRequireLogin }: { poll: Poll; userId: string | null; onChanged: () => void; onRequireLogin: () => void }) {
  const [selected, setSelected] = useState<string[]>(poll.options.filter(o => o.votedByMe).map(o => o.id))
  const [reVote, setReVote] = useState(false)
  const [saving, setSaving] = useState(false)
  const total = poll.options.reduce((sum, o) => sum + o.voteCount, 0)
  const showResults = poll.canSeeResults && !reVote

  const toggle = (id: string) => {
    if (poll.multi) setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
    else setSelected([id])
  }
  const submit = async () => {
    if (!userId) { onRequireLogin(); return }
    if (selected.length === 0) return
    setSaving(true)
    const r = await votePoll(poll.id, selected, userId)
    setSaving(false)
    if (r === 'ok') { setReVote(false); onChanged() }
    else if (r === 'closed') window.alert('마감된 투표예요.')
    else if (r === 'single_only') window.alert('하나만 선택할 수 있어요.')
    else if (r !== 'empty') window.alert('투표에 실패했어요.')
  }

  const endLabel = poll.closed ? '마감됨'
    : poll.endMode === 'date' && poll.endAt ? `${new Date(poll.endAt).toLocaleDateString('ko-KR')} 마감`
    : poll.endMode === 'count' && poll.maxParticipants ? `${poll.participants}/${poll.maxParticipants}명`
    : ''

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px', margin: '4px 0 16px', background: 'var(--surface2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
        <span style={{ fontWeight: 800, fontSize: 15 }}>📊 {poll.title}</span>
        {endLabel && <span style={{ fontSize: 11.5, fontWeight: 700, color: poll.closed ? '#c0392b' : 'var(--muted)' }}>{endLabel}</span>}
      </div>

      {showResults ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {poll.options.map(o => {
            const pct = total > 0 ? Math.round((o.voteCount / total) * 100) : 0
            return (
              <div key={o.id} style={{ position: 'relative', border: '1px solid var(--border)', borderRadius: 9, overflow: 'hidden', background: 'var(--surface)' }}>
                <div style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: o.votedByMe ? 'rgba(232,0,111,.18)' : 'rgba(232,0,111,.08)' }} />
                <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', gap: 8, padding: '10px 12px', fontSize: 14 }}>
                  <span style={{ fontWeight: o.votedByMe ? 800 : 500 }}>{o.votedByMe ? '✓ ' : ''}{o.label}</span>
                  <span style={{ fontWeight: 800, color: 'var(--accent)', flex: 'none' }}>{pct}% · {o.voteCount}</span>
                </div>
              </div>
            )
          })}
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{poll.participants}명 참여{poll.anonymous ? ' · 무기명' : ''}</div>
          {!poll.closed && poll.hasVoted && <button onClick={() => { setSelected(poll.options.filter(o => o.votedByMe).map(o => o.id)); setReVote(true) }} style={pollBtnGhost}>다시 투표</button>}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {poll.options.map(o => {
            const on = selected.includes(o.id)
            return (
              <button key={o.id} onClick={() => toggle(o.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 9, background: on ? 'rgba(232,0,111,.06)' : 'var(--surface)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, textAlign: 'left', color: 'var(--text)' }}>
                <span style={{ width: 16, height: 16, border: `2px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'var(--accent)' : 'transparent', borderRadius: poll.multi ? 4 : 9999, flex: 'none' }} />
                {o.label}
              </button>
            )
          })}
          <button onClick={submit} disabled={saving || selected.length === 0} style={{ ...pollBtn, opacity: selected.length === 0 ? 0.5 : 1 }}>{saving ? '투표 중…' : '투표하기'}</button>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            {poll.multi ? '복수 선택' : '단일 선택'}{poll.anonymous ? ' · 무기명' : ''}
            {poll.viewMode === 'after' ? ' · 투표 후 결과 공개' : poll.viewMode === 'ended' ? ' · 종료 후 결과 공개' : ''}
          </div>
        </div>
      )}
    </div>
  )
}
const pollBtn: React.CSSProperties = { marginTop: 4, padding: '11px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }
const pollBtnGhost: React.CSSProperties = { marginTop: 2, padding: '9px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--muted)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }

function updateCommentLikeTree(list: PostComment[], id: string, liked: boolean): PostComment[] {
  return list.map(c => c.id === id
    ? { ...c, likedByMe: liked, likeCount: Math.max(0, c.likeCount + (liked ? 1 : -1)) }
    : { ...c, replies: updateCommentLikeTree(c.replies, id, liked) })
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}. ${p(d.getHours())}:${p(d.getMinutes())}`
}

function CommentRow({ c, isReply, user, isAdmin, onLike, onReply, onDelete }: {
  c: PostComment; isReply?: boolean; user: { id: string } | null; isAdmin: boolean;
  onLike: (c: PostComment) => void; onReply?: (id: string) => void; onDelete: (id: string) => void
}) {
  const canDelete = isAdmin || (!!user && c.author?.id === user.id)
  return (
    <div style={{ display: 'flex', gap: 10, marginLeft: isReply ? 28 : 0 }}>
      {isReply && <span style={{ color: 'var(--muted)', flexShrink: 0, fontSize: 13, marginTop: 1 }}>↳</span>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 3 }}>{c.author?.nickname ?? '익명'}</div>
        <div style={{ fontSize: 13.5, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{c.content}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 5 }}>
          <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{fmtDateTime(c.createdAt)}</span>
          {!isReply && onReply && <button onClick={() => onReply(c.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>답글</button>}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
        <button onClick={() => onLike(c)} title="좋아요" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, color: c.likedByMe ? '#FF4D6D' : 'var(--muted)' }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill={c.likedByMe ? '#FF4D6D' : 'none'} stroke={c.likedByMe ? '#FF4D6D' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" /></svg>
          {c.likeCount > 0 ? c.likeCount : ''}
        </button>
        {canDelete && <button onClick={() => onDelete(c.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, color: 'var(--muted)' }}>삭제</button>}
      </div>
    </div>
  )
}

const flairBadge: React.CSSProperties = {
  display: 'inline-block', fontSize: 11, fontWeight: 800, color: 'var(--accent)', background: 'var(--accent-l, rgba(232,0,111,.12))',
  padding: '1px 7px', borderRadius: 5, marginRight: 6, verticalAlign: 'middle',
}
const menuItem: React.CSSProperties = {
  display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'none',
  padding: '11px 14px', fontSize: 14, color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit',
}

function sanitizeHtml(html: string): string {
  return html
    .replace(/<\s*(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|style|iframe|object|embed)[^>]*\/?>/gi, '')
    .replace(/ on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*("|')?\s*javascript:[^"'>]*("|')?/gi, '$1="#"')
}

function navBtn(side: 'left' | 'right'): React.CSSProperties {
  return { position: 'absolute', [side]: 10, top: '50%', transform: 'translateY(-50%)', width: 38, height: 38, borderRadius: 9999, border: 'none', background: 'rgba(0,0,0,.45)', color: '#fff', cursor: 'pointer', fontSize: 22, lineHeight: 1 }
}
const adminBtn: React.CSSProperties = {
  padding: '6px 12px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)',
  color: 'var(--text)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit',
}
