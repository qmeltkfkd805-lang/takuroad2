'use client'
import { useState, useEffect, Fragment } from 'react'
import { useAuth } from '@/components/layout/AuthProvider'
import { getMyContactMessages } from '@/services/contactService'
import { CONTACT_TYPES } from './contactConfig'
import styles from './MyContacts.module.css'
import AppIcon from '@/components/tds/AppIcon'

const STATUS: Record<string, { label: string; cls: string }> = {
  pending:    { label: '대기', cls: 'pending' },
  processing: { label: '처리중', cls: 'processing' },
  done:       { label: '답변 완료', cls: 'done' },
}

export default function MyContacts({ refreshKey = 0 }: { refreshKey?: number }) {
  const { user } = useAuth()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    getMyContactMessages(user.id).then(data => { setItems(data); setLoading(false) })
  }, [user, refreshKey])

  if (!user) return null
  if (loading) return null
  if (items.length === 0) return null

  function typeLabel(t: string) {
    return CONTACT_TYPES.find(c => c.key === t)?.label ?? t
  }

  return (
    <section className={styles.wrap}>
      <h3 className={styles.title}>내 문의 내역</h3>
      <table className={styles.table}>
        <thead>
          <tr>
            <th style={{ width: 80 }}>유형</th>
            <th>제목</th>
            <th style={{ width: 80 }}>상태</th>
            <th style={{ width: 90 }}>작성일</th>
          </tr>
        </thead>
        <tbody>
          {items.map(m => {
            const st = STATUS[m.status] ?? STATUS.pending
            const open = openId === m.id
            return (
              <Fragment key={m.id}>
                <tr className={styles.row} onClick={() => setOpenId(open ? null : m.id)}>
                  <td className={styles.type}>{typeLabel(m.type)}</td>
                  <td className={styles.subject}>{m.title}</td>
                  <td><span className={styles.badge + ' ' + styles[st.cls]}>{st.label}</span></td>
                  <td className={styles.date}>{new Date(m.created_at).toLocaleDateString('ko-KR')}</td>
                </tr>
                {open && (
                  <tr className={styles.detailRow}>
                    <td colSpan={4}>
                      <div className={styles.detail}>
                        <div className={styles.detailLabel}>문의 내용</div>
                        <p className={styles.detailContent}>{m.content}</p>
                        {m.attachment_urls?.length > 0 && (
                          <div className={styles.files}>
                            {m.attachment_urls.map((url: string, i: number) => (
                              <a key={i} href={url} target="_blank" rel="noreferrer" className={styles.fileLink}><AppIcon name="clip" size={12} style={{ marginRight: 4 }} />첨부 {i + 1}</a>
                            ))}
                          </div>
                        )}
                        {m.answer
                          ? (
                            <div className={styles.answerBox}>
                              <div className={styles.answerLabel}>답변</div>
                              <p className={styles.answerText}>{m.answer}</p>
                              {m.answered_at && <span className={styles.answered}>답변 완료 · {new Date(m.answered_at).toLocaleDateString('ko-KR')}</span>}
                            </div>
                          )
                          : <p className={styles.waiting}>아직 답변 대기 중이에요. 평균 1~3일 안에 답변 드릴게요.</p>}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}