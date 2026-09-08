'use client'
import { useState } from 'react'
import { useAuth } from '@/components/layout/AuthProvider'
import { submitAppeal, uploadAppealImage } from '@/services/communityPostService'
import { CommunityPost, NewAppeal } from '@/types/community-post'
import AppIcon from '@/components/tds/AppIcon'

/* 숨김 처리된 내 글에 대한 이의제기 폼.

   예전에는 MyPostsPage(=/mypage/posts) 안에만 있었는데, 그 페이지로 가는 링크가
   코드 어디에도 없었다. 즉 글이 숨겨진 사용자는 그 사실을 알 방법도,
   이의제기할 방법도 없었다. 실제로 쓰는 화면인 프로필 > 작성한 글(MyPostsTab)에서
   쓰려고 여기로 뺐다. */

export default function AppealModal({ post, onClose, onDone }: {
  post: CommunityPost
  onClose: () => void
  onDone: () => void
}) {
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
