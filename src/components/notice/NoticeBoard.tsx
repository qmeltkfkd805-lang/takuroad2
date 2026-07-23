'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { getNotices, deleteNotice, Notice } from '@/services/noticeService'
import styles from './noticeBoard.module.css'

function fmt(s: string) {
  return new Date(s).toLocaleDateString('ko-KR')
}

export default function NoticeBoard() {
  const { isAdmin } = useAuth()
  const router = useRouter()
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)

  async function load() {
    setNotices(await getNotices())
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function remove(n: Notice) {
    if (!confirm('이 공지를 삭제할까요?')) return
    const ok = await deleteNotice(n.id)
    if (!ok) alert('삭제에 실패했어요.')
    await load()
  }

  return (
    <div>
      <style>{`
        .nt-content { font-size:16px; line-height:1.8; color:var(--text); }
        .nt-content img { max-width:100%; border-radius:10px; }
        .nt-content blockquote { margin:10px 0; padding:8px 14px; border-left:3px solid var(--accent); color:var(--muted); }
        .nt-content a { color:var(--accent); }
        .nt-content hr { border:none; border-top:1px solid var(--border); margin:18px 0; }
      `}</style>

      {isAdmin && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 18 }}>
          <Link href="/support/notice/write" className={styles.writeBtn}>+ 공지 작성</Link>
        </div>
      )}

      {loading ? (
        <p className={styles.empty}>불러오는 중…</p>
      ) : notices.length === 0 ? (
        <p className={styles.empty}>아직 등록된 공지가 없어요.</p>
      ) : (
        <ul className={styles.list}>
          {notices.map(n => (
            <li key={n.id} className={styles.item}>
              <Link href={'/support/notice/' + n.id} className={styles.head}>
                <span className={styles.headLeft}>
                  {n.is_pinned && <span className={styles.pinTag}>고정</span>}
                  <span className={styles.itemTitle}>{n.title}</span>
                </span>
                <span className={styles.date}>{fmt(n.created_at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}