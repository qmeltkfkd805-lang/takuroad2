'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { getMyPosts, submitAppeal, uploadAppealImage } from '@/services/communityPostService'
import { CommunityPost, REASON_LABEL, BOARD_LABEL, NewAppeal } from '@/types/community-post'
import AppIcon from '@/components/tds/AppIcon'

export default function MyPostsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [loading, setLoading] = useState(true)
  const [appealing, setAppealing] = useState<CommunityPost | null>(null)

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return }
    setLoading(true)
    setPosts(await getMyPosts(user.id))
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 20px 72px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 900, marginBottom: 6 }}>내 글</h1>
      <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 24 }}>내가 올린 글을 관리하고, 숨김 처리된 글에 이의제기할 수 있어요.</p>

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>불러오는 중…</p>
      ) : !user ? (
        <p style={{ color: 'var(--muted)' }}>로그인이 필요해요.</p>
      ) : posts.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>아직 올린 글이 없어요.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {posts.map(post => {
            const hidden = post.status === 'hidden'
            const cover = post.images[0] ?? null
            return (
              <div key={post.id} style={{ border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', background: 'var(--surface)' }}>
                <div style={{ display: 'flex', gap: 14, padding: 14 }}>
                  {cover && (
                    <div style={{ width: 92, height: 92, flexShrink: 0, borderRadius: 12, overflow: 'hidden', background: 'var(--surface2)' }}>
                      <img src={cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', filter: hidden ? 'grayscale(0.4)' : 'none' }} />
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--accent)' }}>{BOARD_LABEL[post.board]}</span>
                      <span style={{ fontSize: 15, fontWeight: 800 }}>{post.title || '제목 없음'}</span>
                      {hidden && <span style={{ fontSize: 11.5, fontWeight: 800, color: '#c0392b', background: 'rgba(239,90,90,.1)', padding: '2px 8px', borderRadius: 9999 }}>임시 숨김</span>}
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{post.work?.name ? `${post.work.name} · ` : ''}좋아요 {post.likeCount} · 댓글 {post.commentCount} · 조회 {post.viewCount}</div>
                    {post.content && <p style={{ fontSize: 13, color: 'var(--muted)', margin: '8px 0 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{stripHtml(post.content)}</p>}
                  </div>
                </div>

                {hidden && (
                  <div style={{ background: 'rgba(239,90,90,.07)', borderTop: '1px solid var(--border)', padding: '13px 16px' }}>
                    <p style={{ fontSize: 13, lineHeight: 1.55, margin: '0 0 8px', color: 'var(--text)' }}>
                      신고가 접수되어 <b>관리자 확인 전까지 임시 숨김</b> 처리되었어요{post.hiddenReason ? ` (사유: ${REASON_LABEL[post.hiddenReason] ?? post.hiddenReason})` : ''}.
                      본인의 창작물이거나 문제가 없다면 아래에서 소명해 주세요. 검토 후 다시 공개될 수 있어요.
                    </p>
                    <button
                      onClick={() => setAppealing(post)}
                      style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 800, color: 'var(--accent)', textDecoration: 'underline' }}
                    >
                      이의제기하기 →
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {appealing && <AppealModal post={appealing} onClose={() => setAppealing(null)} onDone={() => { setAppealing(null); load() }} />}
    </div>
  )
}

function AppealModal({ post, onClose, onDone }: { post: CommunityPost; onClose: () => void; onDone: () => void }) {
  const { user } = useAuth()
  const isCopy = post.hiddenReason === 'copy'
  const [message, setMessage] = useState('')
  const [originalUrl, setOriginalUrl] = useState('')
  const [snsLinks, setSnsLinks] = useState<string[]>([''])
  const [proofFiles, setProofFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)

  const setLink = (i: number, v: string) => setSnsLinks(prev => prev.map((x, idx) => (idx === i ? v : x)))
  const addLink = () => setSnsLinks(prev => [...prev, ''])
  const removeLink = (i: number) => setSnsLinks(prev => prev.filter((_, idx) => idx !== i))

  const submit = async () => {
    if (!user) return
    setSaving(true)
    let proofImages: string[] = []
    if (isCopy && proofFiles.length) {
      const urls = await Promise.all(proofFiles.map(f => uploadAppealImage(f, user.id)))
      proofImages = urls.filter(Boolean) as string[]
    }
    const payload: NewAppeal = {
      message,
      originalUrl,
      snsLinks: snsLinks.map(s => s.trim()).filter(Boolean),
      proofImages,
    }
    const ok = await submitAppeal(post.id, user.id, payload)
    setSaving(false)
    if (ok) { window.alert('이의제기가 접수되었어요. 관리자 확인 후 처리됩니다.'); onDone() }
    else window.alert('이의제기 접수에 실패했어요.')
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2200, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 18, maxWidth: 480, width: '100%', maxHeight: '90vh', overflow: 'auto', padding: '22px 22px 24px' }}>
        <h3 style={{ fontSize: 18, fontWeight: 900, margin: '0 0 4px' }}>이의제기</h3>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 16px' }}>본인의 창작물임을 확인할 수 있는 자료를 첨부하면 검토에 도움이 돼요.</p>

        <Label>소명 내용</Label>
        <textarea value={message} onChange={e => setMessage(e.target.value)} maxLength={800} rows={4} placeholder="직접 만든/그린 작품인지, 어떤 상황인지 설명해주세요." style={{ ...inp, resize: 'vertical' }} />

        <Label>원본 링크 (Pixiv / X / Instagram 등)</Label>
        <input value={originalUrl} onChange={e => setOriginalUrl(e.target.value)} placeholder="예: https://www.pixiv.net/artworks/..." style={inp} />

        <Label>SNS 계정 링크 (선택)</Label>
        {snsLinks.map((lnk, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input value={lnk} onChange={e => setLink(i, e.target.value)} placeholder="본인 SNS 계정 URL" style={{ ...inp, marginBottom: 0 }} />
            {snsLinks.length > 1 && <button onClick={() => removeLink(i)} style={miniBtn}><AppIcon name="close" size={12} /></button>}
          </div>
        ))}
        <button onClick={addLink} style={{ ...miniBtn, width: 'auto', padding: '8px 12px', marginBottom: 8 }}>+ 링크 추가</button>
        <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5, margin: '0 0 14px' }}>
          SNS 계정을 첨부하면, 확인을 위해 관리자가 해당 계정으로 <b>DM(다이렉트 메시지)</b>을 보낼 수 있어요.
        </p>

        {isCopy && (
          <>
            <Label>증거 이미지 첨부 (도용 신고 대응)</Label>
            <label style={{ display: 'block', border: '1.5px dashed var(--border)', borderRadius: 12, padding: '18px 12px', textAlign: 'center', cursor: 'pointer', marginBottom: 6, fontSize: 13, color: 'var(--muted)' }}>
              작업 과정·원본 파일 등 본인 작품임을 증명할 이미지 선택
              <input type="file" accept="image/*" multiple onChange={e => setProofFiles(Array.from(e.target.files ?? []))} style={{ display: 'none' }} />
            </label>
            {proofFiles.length > 0 && <p style={{ fontSize: 12.5, color: 'var(--accent)', margin: '0 0 12px' }}>{proofFiles.length}개 선택됨</p>}
          </>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
          <button onClick={submit} disabled={saving} style={{ flex: 2, padding: '12px', borderRadius: 12, border: 'none', background: saving ? 'var(--border)' : 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit' }}>{saving ? '접수 중…' : '이의제기 제출'}</button>
        </div>
      </div>
    </div>
  )
}

function stripHtml(html: string): string { return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim() }

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 13, fontWeight: 800, margin: '4px 0 6px' }}>{children}</div>
}
const inp: React.CSSProperties = {
  width: '100%', padding: '11px 13px', borderRadius: 10, border: '1px solid var(--border)',
  background: 'var(--surface)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit',
  marginBottom: 12, boxSizing: 'border-box',
}
const miniBtn: React.CSSProperties = {
  flexShrink: 0, padding: '0 12px', borderRadius: 10, border: '1px solid var(--border)',
  background: 'var(--surface)', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14,
}