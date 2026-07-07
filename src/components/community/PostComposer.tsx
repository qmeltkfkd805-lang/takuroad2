'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { ROUTES } from '@/lib/constants/routes'
import { getAllTagsForSelect } from '@/services/routeService'
import { createPost, uploadPostImage } from '@/services/communityPostService'
import { Board, BOARDS, boardMeta, NewPost } from '@/types/community-post'

type Tag = { id: string; name: string; slug: string }

const FANART_AGREE = [
  '본인이 직접 그린 그림입니다.',
  '타인의 그림을 무단으로 업로드하지 않았습니다.',
  'AI를 이용하지 않았습니다.',
  '신고가 접수될 경우 운영 정책에 따라 임시 숨김될 수 있습니다.',
]

export default function PostComposer({
  presetBoard, presetTagId, lockBoard, lockTag, onClose, onDone,
}: {
  presetBoard?: Board
  presetTagId?: string | null
  lockBoard?: boolean   // 게시판 고정(작품 상세에서 진입 등)
  lockTag?: boolean     // 작품 고정(작품 상세에서 진입)
  onClose: () => void
  onDone: (postId: string) => void
}) {
  const { user, isAdmin } = useAuth()
  const router = useRouter()

  const [board, setBoard] = useState<Board>(presetBoard ?? 'fanart')
  const [tags, setTags] = useState<Tag[]>([])
  const [tagId, setTagId] = useState<string | null>(presetTagId ?? null)
  const [tagQuery, setTagQuery] = useState('')
  const [tagOpen, setTagOpen] = useState(false)

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [showOnWork, setShowOnWork] = useState(true)
  const [agree, setAgree] = useState([false, false, false, false])
  const [saving, setSaving] = useState(false)
  const [isNotice, setIsNotice] = useState(false)
  const [err, setErr] = useState('')

  const meta = boardMeta(board)!
  const selectedTag = tags.find(t => t.id === tagId) || null

  useEffect(() => { getAllTagsForSelect().then((t) => setTags(t as Tag[])).catch(() => setTags([])) }, [])

  const addFiles = (list: FileList | null) => {
    const arr = Array.from(list ?? [])
    setFiles(prev => [...prev, ...arr])
    setPreviews(prev => [...prev, ...arr.map(f => URL.createObjectURL(f))])
  }
  const removeFile = (i: number) => {
    setFiles(prev => prev.filter((_, idx) => idx !== i))
    setPreviews(prev => prev.filter((_, idx) => idx !== i))
  }

  const filteredTags = tagQuery.trim()
    ? tags.filter(t => t.name.toLowerCase().includes(tagQuery.trim().toLowerCase())).slice(0, 30)
    : tags.slice(0, 30)

  const isFanart = board === 'fanart'
  const allAgreed = !isFanart || agree.every(Boolean)

  const validate = (): string => {
    if (meta.tagRequired && !tagId) return `${meta.label}은(는) 작품 태그를 반드시 선택해야 해요.`
    if (meta.imageRequired && files.length === 0) return '이미지를 1장 이상 첨부해주세요.'
    if (!title.trim() && !content.trim() && files.length === 0) return '내용을 입력해주세요.'
    if (isFanart && !allAgreed) return '팬아트 업로드 전 확인 항목에 모두 동의해주세요.'
    return ''
  }

  const submit = async () => {
    if (!user) { router.push(ROUTES.login); return }
    const v = validate()
    if (v) { setErr(v); return }
    setErr(''); setSaving(true)
    let images: string[] = []
    if (files.length) {
      const urls = await Promise.all(files.map(f => uploadPostImage(f, user.id)))
      images = urls.filter(Boolean) as string[]
    }
    const payload: NewPost = { board, tagId, title, content, images, showOnWork, isNotice: isAdmin ? isNotice : false }
    const id = await createPost(user.id, payload)
    setSaving(false)
    if (id) onDone(id)
    else setErr('등록에 실패했어요. 잠시 후 다시 시도해주세요.')
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2100, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 18, maxWidth: 560, width: '100%', maxHeight: '92vh', overflow: 'auto', padding: '22px 22px 24px' }}>
        <h3 style={{ fontSize: 19, fontWeight: 900, margin: '0 0 16px' }}>글쓰기</h3>

        {/* 게시판 선택 */}
        <Label>게시판</Label>
        {lockBoard ? (
          <div style={{ ...inp, display: 'flex', alignItems: 'center', color: 'var(--muted)' }}>{meta.label}</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 14 }}>
            {BOARDS.map(b => (
              <button key={b.value} onClick={() => setBoard(b.value)} style={{
                padding: '8px 13px', borderRadius: 9999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                border: `1.5px solid ${board === b.value ? 'var(--accent)' : 'var(--border)'}`,
                background: board === b.value ? 'var(--accent-l, rgba(232,0,111,.08))' : 'var(--surface)',
                color: board === b.value ? 'var(--accent)' : 'var(--text)',
              }}>{b.label}</button>
            ))}
          </div>
        )}

        {/* 작품 태그 */}
        <Label>작품 태그 {meta.tagRequired ? <b style={{ color: 'var(--accent)' }}>필수</b> : meta.tagRecommended ? <span style={{ color: 'var(--muted)' }}>(권장)</span> : <span style={{ color: 'var(--muted)' }}>(선택)</span>}</Label>
        {lockTag && selectedTag ? (
          <div style={{ ...inp, display: 'flex', alignItems: 'center', color: 'var(--text)' }}>{selectedTag.name}</div>
        ) : (
          <div style={{ position: 'relative', marginBottom: 6 }}>
            <input
              value={selectedTag && !tagOpen ? selectedTag.name : tagQuery}
              onChange={e => { setTagQuery(e.target.value); setTagOpen(true); setTagId(null) }}
              onFocus={() => setTagOpen(true)}
              placeholder="작품 이름 검색"
              style={{ ...inp, marginBottom: 0 }}
            />
            {tagOpen && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 5, marginTop: 4, maxHeight: 220, overflow: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,.12)' }}>
                {filteredTags.length === 0 ? (
                  <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--muted)' }}>검색 결과가 없어요</div>
                ) : filteredTags.map(t => (
                  <button key={t.id} onClick={() => { setTagId(t.id); setTagQuery(''); setTagOpen(false) }} style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'none', padding: '10px 14px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, color: 'var(--text)' }}>{t.name}</button>
                ))}
              </div>
            )}
          </div>
        )}
        {selectedTag && !lockTag && <div style={{ fontSize: 12.5, color: 'var(--accent)', marginBottom: 12 }}>선택됨: {selectedTag.name} <button onClick={() => { setTagId(null) }} style={{ border: 'none', background: 'none', color: 'var(--muted)', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}>해제</button></div>}

        {/* 제목 / 내용 */}
        <Label>제목</Label>
        <input value={title} onChange={e => setTitle(e.target.value)} maxLength={80} placeholder="제목" style={inp} />
        <Label>내용</Label>
        <textarea value={content} onChange={e => setContent(e.target.value)} maxLength={2000} rows={4} placeholder="내용을 입력하세요" style={{ ...inp, resize: 'vertical' }} />

        {/* 이미지 */}
        <Label>이미지 {meta.imageRequired && <b style={{ color: 'var(--accent)' }}>필수</b>}</Label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          {previews.map((src, i) => (
            <div key={i} style={{ position: 'relative', width: 76, height: 76, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
              <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button onClick={() => removeFile(i)} aria-label="삭제" style={{ position: 'absolute', top: 3, right: 3, width: 20, height: 20, borderRadius: 9999, border: 'none', background: 'rgba(0,0,0,.6)', color: '#fff', cursor: 'pointer', fontSize: 12, lineHeight: 1 }}>×</button>
            </div>
          ))}
          <label style={{ width: 76, height: 76, borderRadius: 10, border: '1.5px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--muted)', fontSize: 24 }}>
            +
            <input type="file" accept="image/*" multiple onChange={e => addFiles(e.target.files)} style={{ display: 'none' }} />
          </label>
        </div>

        {/* 작품 상세 노출 체크 (태그 있을 때만) */}
        {tagId && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13.5, cursor: 'pointer', marginBottom: 14 }}>
            <input type="checkbox" checked={showOnWork} onChange={() => setShowOnWork(v => !v)} style={{ accentColor: 'var(--accent)' }} />
            <span>작품 상세 페이지에도 함께 등록 {showOnWork ? '' : '(커뮤니티에만 표시)'}</span>
          </label>
        )}

        {isAdmin && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13.5, cursor: 'pointer', marginBottom: 14 }}>
            <input type="checkbox" checked={isNotice} onChange={() => setIsNotice(v => !v)} style={{ accentColor: 'var(--accent)' }} />
            <span>📌 공지로 등록 (상단 고정)</span>
          </label>
        )}

        {/* 팬아트 필수 동의 */}
        {isFanart && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 14px', background: 'var(--surface2)', borderRadius: 12, marginBottom: 14 }}>
            {FANART_AGREE.map((label, i) => (
              <label key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, lineHeight: 1.4, cursor: 'pointer' }}>
                <input type="checkbox" checked={agree[i]} onChange={() => setAgree(prev => prev.map((v, idx) => (idx === i ? !v : v)))} style={{ marginTop: 2, accentColor: 'var(--accent)', flexShrink: 0 }} />
                <span>{label}</span>
              </label>
            ))}
          </div>
        )}

        {err && <div style={{ fontSize: 13, color: '#c0392b', marginBottom: 12 }}>{err}</div>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '13px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, fontSize: 14.5, cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
          <button onClick={submit} disabled={saving} style={{ flex: 2, padding: '13px', borderRadius: 12, border: 'none', background: saving ? 'var(--border)' : 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 14.5, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit' }}>{saving ? '등록 중…' : '등록하기'}</button>
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
