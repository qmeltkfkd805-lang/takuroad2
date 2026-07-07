'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { ROUTES } from '@/lib/constants/routes'
import {
  getRepresentativeFanArt, getWorkGalleryFanArts, toggleFanArtLike,
  uploadFanArtImage, createFanArt, incrementFanArtView,
  hideFanArt, deleteFanArt, reportFanArt,
} from '@/services/fanArtService'
import { FanArt, FanArtSort, ReportReason, REPORT_REASONS } from '@/types/fan-art'

export default function FanGallery({ tagId, workName }: { tagId: string; workName: string }) {
  const { user, isAdmin } = useAuth()
  const router = useRouter()
  const [rep, setRep] = useState<FanArt | null>(null)
  const [arts, setArts] = useState<FanArt[]>([])
  const [sort, setSort] = useState<FanArtSort>('popular')
  const [loading, setLoading] = useState(true)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [viewing, setViewing] = useState<FanArt | null>(null)
  const [reporting, setReporting] = useState<FanArt | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [r, list] = await Promise.all([
      getRepresentativeFanArt(tagId, user?.id),
      getWorkGalleryFanArts(tagId, sort, user?.id),
    ])
    setRep(r); setArts(list); setLoading(false)
  }, [tagId, sort, user?.id])

  useEffect(() => { load() }, [load])

  const applyLike = (id: string, liked: boolean) => {
    const upd = (a: FanArt): FanArt => a.id === id ? { ...a, likedByMe: liked, likeCount: Math.max(0, a.likeCount + (liked ? 1 : -1)) } : a
    setArts(prev => prev.map(upd))
    setRep(prev => (prev && prev.id === id ? upd(prev) : prev))
    setViewing(prev => (prev && prev.id === id ? upd(prev) : prev))
  }
  const like = async (art: FanArt) => {
    if (!user) { router.push(ROUTES.login); return }
    const server = await toggleFanArtLike(art.id, user.id)
    applyLike(art.id, server)
  }

  const openView = (art: FanArt) => {
    setViewing(art)
    incrementFanArtView(art.id)
  }

  const onHide = async (art: FanArt) => {
    if (!window.confirm('이 팬아트를 숨길까요?')) return
    await hideFanArt(art.id); setViewing(null); load()
  }
  const onDelete = async (art: FanArt) => {
    if (!window.confirm('이 팬아트를 삭제할까요? 되돌릴 수 없어요.')) return
    await deleteFanArt(art.id); setViewing(null); load()
  }

  return (
    <div>
      {/* 🏆 이번 주 대표 팬아트 */}
      {rep && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
            <TrophyIcon />
            <h3 style={{ fontSize: 16, fontWeight: 900, margin: 0 }}>이번 주 대표 팬아트</h3>
          </div>
          <div
            onClick={() => openView(rep)}
            style={{ position: 'relative', borderRadius: 18, overflow: 'hidden', cursor: 'zoom-in', border: '1px solid var(--border)', background: 'var(--surface2)' }}
          >
            <img src={rep.imageUrl} alt={rep.title ?? '대표 팬아트'} style={{ width: '100%', maxHeight: 420, objectFit: 'cover', display: 'block' }} />
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '28px 20px 16px', background: 'linear-gradient(0deg, rgba(0,0,0,.72), rgba(0,0,0,0))', color: '#fff', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                {rep.title && <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>{rep.title}</div>}
                <div style={{ fontSize: 13, opacity: 0.9 }}>{rep.author?.nickname ?? '익명'}</div>
              </div>
              <LikeButton art={rep} onClick={(e) => { e.stopPropagation(); like(rep) }} light />
            </div>
          </div>
        </div>
      )}

      {/* 🎨 팬 갤러리 헤더 + 정렬 + 업로드 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <PaletteIcon />
          <h3 style={{ fontSize: 16, fontWeight: 900, margin: 0 }}>팬 갤러리</h3>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>{arts.length}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['popular', 'latest'] as FanArtSort[]).map(s => (
              <button key={s} onClick={() => setSort(s)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: s === sort ? 800 : 600, color: s === sort ? 'var(--accent)' : 'var(--muted)' }}>
                {s === 'popular' ? '인기순' : '최신순'}
              </button>
            ))}
          </div>
          <button onClick={() => (user ? setUploadOpen(true) : router.push(ROUTES.login))} style={uploadBtn}>
            <PlusIcon /> 팬아트 업로드
          </button>
        </div>
      </div>

      {/* 갤러리 그리드 */}
      {loading ? (
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>불러오는 중…</p>
      ) : arts.length === 0 ? (
        <div style={{ border: '1px dashed var(--border)', borderRadius: 16, padding: '40px 20px', textAlign: 'center', color: 'var(--muted)' }}>
          <p style={{ margin: '0 0 14px', fontSize: 14 }}>아직 등록된 팬아트가 없어요. 첫 팬아트를 올려보세요!</p>
          <button onClick={() => (user ? setUploadOpen(true) : router.push(ROUTES.login))} style={uploadBtn}><PlusIcon /> 팬아트 업로드</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
          {arts.map(art => (
            <div key={art.id} style={{ border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', background: 'var(--surface)' }}>
              <div onClick={() => openView(art)} style={{ position: 'relative', aspectRatio: '1 / 1', cursor: 'zoom-in', background: 'var(--surface2)' }}>
                <img src={art.imageUrl} alt={art.title ?? '팬아트'} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </div>
              <div style={{ padding: '9px 11px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 12.5, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{art.author?.nickname ?? '익명'}</span>
                <LikeButton art={art} onClick={() => like(art)} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 업로드 모달 */}
      {uploadOpen && <UploadModal tagId={tagId} workName={workName} onClose={() => setUploadOpen(false)} onDone={() => { setUploadOpen(false); load() }} />}

      {/* 신고 모달 */}
      {reporting && <ReportModal art={reporting} onClose={() => setReporting(null)} />}

      {/* 상세 보기 모달 */}
      {viewing && (
        <div onClick={() => setViewing(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 18, maxWidth: 560, width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
            <img src={viewing.imageUrl} alt="" style={{ width: '100%', maxHeight: '60vh', objectFit: 'contain', display: 'block', background: '#000' }} />
            <div style={{ padding: '18px 20px 22px' }}>
              {viewing.title && <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 8px' }}>{viewing.title}</h3>}
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>{viewing.author?.nickname ?? '익명'} · 조회 {viewing.viewCount}</div>
              {viewing.description && <p style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: '0 0 16px' }}>{viewing.description}</p>}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <LikeButton art={viewing} onClick={() => like(viewing)} />
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {user && viewing.author?.id !== user.id && (
                    <button onClick={() => setReporting(viewing)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: 'var(--muted)', textDecoration: 'underline' }}>신고</button>
                  )}
                  {isAdmin && (
                    <>
                      <button onClick={() => onHide(viewing)} style={adminBtn}>숨김</button>
                      <button onClick={() => onDelete(viewing)} style={{ ...adminBtn, color: '#e04343' }}>삭제</button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 업로드 모달 ──
function UploadModal({ tagId, workName, onClose, onDone }: { tagId: string; workName: string; onClose: () => void; onDone: () => void }) {
  const { user } = useAuth()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [saving, setSaving] = useState(false)
  const [agree, setAgree] = useState([false, false, false, false])
  const allAgreed = agree.every(Boolean)
  const toggleAgree = (i: number) => setAgree(prev => prev.map((v, idx) => (idx === i ? !v : v)))

  const pick = (f: File | null) => {
    setFile(f)
    setPreview(f ? URL.createObjectURL(f) : null)
  }
  const submit = async () => {
    if (!user || !file || !allAgreed) return
    setSaving(true)
    const url = await uploadFanArtImage(file, user.id)
    if (!url) { setSaving(false); window.alert('이미지 업로드에 실패했어요.'); return }
    const id = await createFanArt(user.id, { tagId, title, description: desc, imageUrl: url, showInGallery: true })
    setSaving(false)
    if (id) onDone()
    else window.alert('등록에 실패했어요.')
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2100, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 18, maxWidth: 460, width: '100%', maxHeight: '90vh', overflow: 'auto', padding: '22px 22px 24px' }}>
        <h3 style={{ fontSize: 18, fontWeight: 900, margin: '0 0 4px' }}>팬아트 업로드</h3>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 16px' }}>{workName} 팬 갤러리와 커뮤니티에 함께 등록돼요.</p>

        <label style={{ display: 'block', border: '1.5px dashed var(--border)', borderRadius: 12, padding: preview ? 0 : '32px 16px', textAlign: 'center', cursor: 'pointer', overflow: 'hidden', marginBottom: 14 }}>
          {preview
            ? <img src={preview} alt="" style={{ width: '100%', maxHeight: 260, objectFit: 'contain', display: 'block' }} />
            : <span style={{ fontSize: 13, color: 'var(--muted)' }}>이미지를 선택하세요</span>}
          <input type="file" accept="image/*" onChange={e => pick(e.target.files?.[0] ?? null)} style={{ display: 'none' }} />
        </label>

        <input value={title} onChange={e => setTitle(e.target.value)} maxLength={60} placeholder="제목 (선택)" style={inp} />
        <textarea value={desc} onChange={e => setDesc(e.target.value)} maxLength={500} placeholder="설명 (선택)" rows={3} style={{ ...inp, resize: 'vertical' }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, margin: '4px 0 16px' }}>
          {AGREE_LABELS.map((label, i) => (
            <label key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 13, lineHeight: 1.4, cursor: 'pointer', color: 'var(--text)' }}>
              <input type="checkbox" checked={agree[i]} onChange={() => toggleAgree(i)} style={{ marginTop: 2, accentColor: 'var(--accent)', flexShrink: 0 }} />
              <span>{label}</span>
            </label>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
          <button onClick={submit} disabled={!file || !allAgreed || saving} style={{ flex: 2, padding: '12px', borderRadius: 12, border: 'none', background: file && allAgreed && !saving ? 'var(--accent)' : 'var(--border)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: file && allAgreed && !saving ? 'pointer' : 'default', fontFamily: 'inherit' }}>
            {saving ? '올리는 중…' : '등록하기'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 좋아요 버튼 ──
function LikeButton({ art, onClick, light }: { art: FanArt; onClick: (e: React.MouseEvent) => void; light?: boolean }) {
  const active = art.likedByMe
  const color = active ? '#FF4D6D' : light ? '#fff' : 'var(--muted)'
  return (
    <button onClick={onClick} aria-label="좋아요" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: 'none', background: light ? 'rgba(255,255,255,.18)' : 'none', padding: light ? '6px 12px' : '4px 6px', borderRadius: 9999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 800, color }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill={active ? '#FF4D6D' : 'none'} stroke={active ? '#FF4D6D' : color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" /></svg>
      {art.likeCount}
    </button>
  )
}

function TrophyIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F5B100" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" /></svg>
}
function PaletteIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r="1.5" fill="var(--accent)" /><circle cx="17.5" cy="10.5" r="1.5" fill="var(--accent)" /><circle cx="8.5" cy="7.5" r="1.5" fill="var(--accent)" /><circle cx="6.5" cy="12.5" r="1.5" fill="var(--accent)" /><path d="M12 2a10 10 0 0 0 0 20c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.2 0-1.1.9-2 2-2h2.4A4.6 4.6 0 0 0 22 10.5C22 5.8 17.5 2 12 2z" /></svg>
}
function PlusIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
}

const AGREE_LABELS = [
  '본인이 직접 그린 그림입니다.',
  '타인의 그림을 무단으로 업로드하지 않았습니다.',
  'AI를 이용하지 않았습니다.',
  '신고가 접수될 경우 운영 정책에 따라 임시 숨김될 수 있습니다.',
]

function ReportModal({ art, onClose }: { art: FanArt; onClose: () => void }) {
  const { user } = useAuth()
  const [reason, setReason] = useState<ReportReason | ''>('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState<'ok' | 'duplicate' | null>(null)

  const canSubmit = !!reason && (reason !== 'etc' || content.trim().length > 0) && !saving

  const submit = async () => {
    if (!user || !reason) return
    setSaving(true)
    const r = await reportFanArt(art.id, user.id, reason, content)
    setSaving(false)
    if (r === 'ok') setDone('ok')
    else if (r === 'duplicate') setDone('duplicate')
    else window.alert('신고에 실패했어요.')
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2200, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 18, maxWidth: 400, width: '100%', padding: '22px 22px 24px' }}>
        {done ? (
          <div style={{ textAlign: 'center' }}>
            <h3 style={{ fontSize: 17, fontWeight: 900, margin: '0 0 8px' }}>{done === 'ok' ? '신고가 접수되었어요' : '이미 신고한 팬아트예요'}</h3>
            <p style={{ fontSize: 14, color: 'var(--muted)', margin: '0 0 18px' }}>{done === 'ok' ? '운영팀이 확인할게요. 감사합니다.' : '같은 게시글은 한 번만 신고할 수 있어요.'}</p>
            <button onClick={onClose} style={{ width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>확인</button>
          </div>
        ) : (
          <>
            <h3 style={{ fontSize: 17, fontWeight: 900, margin: '0 0 10px' }}>팬아트 신고</h3>
            <div style={{ fontSize: 12.5, color: '#c0392b', background: 'rgba(239,90,90,.08)', borderRadius: 10, padding: '9px 12px', marginBottom: 14, lineHeight: 1.5 }}>
              허위 신고가 반복될 경우 신고 기능이 제한될 수 있어요.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
              {REPORT_REASONS.map(r => (
                <label key={r.value} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 10px', borderRadius: 10, cursor: 'pointer', fontSize: 14, background: reason === r.value ? 'var(--accent-l, rgba(232,0,111,.07))' : 'transparent' }}>
                  <input type="radio" name="report-reason" checked={reason === r.value} onChange={() => setReason(r.value)} style={{ accentColor: 'var(--accent)' }} />
                  {r.label}
                </label>
              ))}
            </div>
            {reason === 'etc' && (
              <textarea value={content} onChange={e => setContent(e.target.value)} maxLength={300} placeholder="신고 내용을 입력해주세요 (필수)" rows={3} style={{ ...inp, resize: 'vertical' }} />
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button onClick={onClose} style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
              <button onClick={submit} disabled={!canSubmit} style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: canSubmit ? '#e04343' : 'var(--border)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: canSubmit ? 'pointer' : 'default', fontFamily: 'inherit' }}>{saving ? '접수 중…' : '신고하기'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const uploadBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '9px 15px', borderRadius: 10,
  border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 13.5,
  cursor: 'pointer', fontFamily: 'inherit',
}
const adminBtn: React.CSSProperties = {
  padding: '7px 13px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)',
  color: 'var(--text)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
}
const inp: React.CSSProperties = {
  width: '100%', padding: '11px 13px', borderRadius: 10, border: '1px solid var(--border)',
  background: 'var(--surface)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit',
  marginBottom: 10, boxSizing: 'border-box',
}
