'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { getNoticeById, deleteNotice, Notice } from '@/services/noticeService'

export default function NoticeDetailPage({ id }: { id: string }) {
  const { isAdmin } = useAuth()
  const router = useRouter()
  const [notice, setNotice] = useState<Notice | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getNoticeById(id).then(n => { setNotice(n); setLoading(false) })
  }, [id])

  async function remove() {
    if (!notice) return
    if (!confirm('이 공지를 삭제할까요?')) return
    const ok = await deleteNotice(notice.id)
    if (!ok) { alert('삭제에 실패했어요.'); return }
    router.push('/support/notice')
    router.refresh()
  }

  if (loading) {
    return <div style={{ padding: '80px 24px', textAlign: 'center', color: 'var(--muted)' }}>불러오는 중…</div>
  }
  if (!notice) {
    return (
      <div style={{ padding: '80px 24px', textAlign: 'center' }}>
        <p style={{ color: 'var(--muted)', marginBottom: 18 }}>공지를 찾을 수 없어요.</p>
        <Link href="/support/notice" style={{ color: 'var(--accent)', fontWeight: 700, textDecoration: 'none' }}>공지사항으로</Link>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', padding: '28px 40px 90px' }}>
      <style>{`
        .nt-content { font-size:16px; line-height:1.85; color:var(--text); }
        .nt-content img { max-width:100%; border-radius:10px; }
        .nt-content blockquote { margin:12px 0; padding:8px 14px; border-left:3px solid var(--accent); color:var(--muted); }
        .nt-content a { color:var(--accent); }
        .nt-content hr { border:none; border-top:1px solid var(--border); margin:20px 0; }
      `}</style>

      <Link href="/support/notice" style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--accent)', textDecoration: 'none' }}>← 공지사항</Link>

      <div style={{ marginTop: 18, paddingBottom: 20, borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          {notice.is_pinned && (
            <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', background: 'var(--accent-l, rgba(232,0,111,.08))', padding: '3px 9px', borderRadius: 9999 }}>고정</span>
          )}
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>{new Date(notice.created_at).toLocaleDateString('ko-KR')}</span>
        </div>
        <h1 style={{ fontSize: 27, fontWeight: 900, lineHeight: 1.35, margin: 0 }}>{notice.title}</h1>
      </div>

      <div className="nt-content" style={{ marginTop: 28 }} dangerouslySetInnerHTML={{ __html: notice.content }} />

      {isAdmin && (
        <div style={{ display: 'flex', gap: 8, marginTop: 40, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
          <Link
            href={'/support/notice/write?edit=' + notice.id}
            style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}
          >수정</Link>
          <button
            onClick={remove}
            style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid var(--red, #e04343)', background: 'var(--surface)', color: 'var(--red, #e04343)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          >삭제</button>
        </div>
      )}
    </div>
  )
}