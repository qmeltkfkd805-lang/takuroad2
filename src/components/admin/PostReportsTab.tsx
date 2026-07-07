'use client'

import { useState, useEffect, useCallback } from 'react'
import { getReportedPosts, getPostAppeals, restorePost, deletePost } from '@/services/communityPostService'
import { ReportedPost, PostAppeal, REASON_LABEL, BOARD_LABEL } from '@/types/community-post'

export default function PostReportsTab() {
  const [items, setItems] = useState<ReportedPost[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setItems(await getReportedPosts())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const onRestore = async (id: string) => {
    if (!window.confirm('이 글을 다시 공개할까요?')) return
    await restorePost(id); load()
  }
  const onDelete = async (id: string) => {
    if (!window.confirm('이 글을 삭제할까요? 되돌릴 수 없어요.')) return
    await deletePost(id); load()
  }

  if (loading) return <p style={{ color: 'var(--muted)', padding: 20 }}>불러오는 중…</p>
  if (items.length === 0) return <p style={{ color: 'var(--muted)', padding: 20 }}>신고되거나 숨김 처리된 글이 없어요.</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 0' }}>
      {items.map(item => <ReportCard key={item.post.id} item={item} onRestore={onRestore} onDelete={onDelete} />)}
    </div>
  )
}

function ReportCard({ item, onRestore, onDelete }: { item: ReportedPost; onRestore: (id: string) => void; onDelete: (id: string) => void }) {
  const { post, reportCount, reasonCounts, reports } = item
  const hidden = post.status === 'hidden'
  const cover = post.images[0] ?? null
  const [appeals, setAppeals] = useState<PostAppeal[] | null>(null)
  const [showAppeals, setShowAppeals] = useState(false)

  const loadAppeals = async () => {
    if (appeals === null) setAppeals(await getPostAppeals(post.id))
    setShowAppeals(v => !v)
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 14, padding: 14 }}>
        {cover && <img src={cover} alt="" style={{ width: 88, height: 88, flexShrink: 0, borderRadius: 10, objectFit: 'cover', background: 'var(--surface2)' }} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--accent)' }}>{BOARD_LABEL[post.board]}</span>
            <span style={{ fontSize: 15, fontWeight: 800 }}>{post.title || '제목 없음'}</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: hidden ? '#c0392b' : 'var(--muted)', background: hidden ? 'rgba(239,90,90,.1)' : 'var(--surface2)', padding: '2px 8px', borderRadius: 9999 }}>
              {hidden ? `임시 숨김 (${post.hiddenBy === 'auto' ? '자동' : '관리자'})` : '공개중'}
            </span>
            <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--accent)' }}>신고 {reportCount}건</span>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 8 }}>{post.work?.name ? `${post.work.name} · ` : ''}{post.author?.nickname ?? '익명'}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]).map(([reason, cnt]) => (
              <span key={reason} style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', background: 'var(--surface2)', padding: '3px 9px', borderRadius: 9999 }}>
                {REASON_LABEL[reason] ?? reason} {cnt}
              </span>
            ))}
          </div>
        </div>
      </div>

      {reports.some(r => r.content) && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '10px 14px', background: 'var(--surface2)' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', marginBottom: 6 }}>신고 내용</div>
          {reports.filter(r => r.content).map((r, i) => (
            <div key={i} style={{ fontSize: 12.5, color: 'var(--text)', marginBottom: 4 }}>· [{REASON_LABEL[r.reason] ?? r.reason}] {r.content}</div>
          ))}
        </div>
      )}

      <div style={{ borderTop: '1px solid var(--border)', padding: '10px 14px' }}>
        <button onClick={loadAppeals} style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>
          이의제기 {showAppeals ? '접기 ▲' : '보기 ▼'}
        </button>
        {showAppeals && (
          appeals && appeals.length > 0 ? (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {appeals.map(ap => (
                <div key={ap.id} style={{ background: 'var(--surface2)', borderRadius: 10, padding: '11px 13px' }}>
                  {ap.message && <p style={{ fontSize: 13, lineHeight: 1.55, margin: '0 0 8px', whiteSpace: 'pre-wrap' }}>{ap.message}</p>}
                  {ap.originalUrl && <div style={{ fontSize: 12.5, marginBottom: 4 }}>원본: <a href={ap.originalUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>{ap.originalUrl}</a></div>}
                  {ap.snsLinks.length > 0 && (
                    <div style={{ fontSize: 12.5, marginBottom: 6 }}>SNS: {ap.snsLinks.map((l, i) => (
                      <a key={i} href={l} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', marginRight: 8 }}>{l}</a>
                    ))}</div>
                  )}
                  {ap.proofImages.length > 0 && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                      {ap.proofImages.map((img, i) => (
                        <a key={i} href={img} target="_blank" rel="noreferrer"><img src={img} alt="" style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover' }} /></a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '8px 0 0' }}>{appeals === null ? '불러오는 중…' : '접수된 이의제기가 없어요.'}</p>
          )
        )}
      </div>

      <div style={{ borderTop: '1px solid var(--border)', padding: '12px 14px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        {hidden && <button onClick={() => onRestore(post.id)} style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 800, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}>다시 공개</button>}
        <button onClick={() => onDelete(post.id)} style={{ padding: '9px 16px', borderRadius: 10, border: 'none', background: '#e04343', color: '#fff', fontWeight: 800, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}>삭제</button>
      </div>
    </div>
  )
}
