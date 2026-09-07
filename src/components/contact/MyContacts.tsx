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
  /* undefined = 사용자가 아직 아무 행도 누르지 않음 → 알림으로 넘어온 문의를 편다.
     null = 사용자가 직접 닫음. 이렇게 구분해야 닫은 행이 다시 열리지 않는다. */
  const [openId, setOpenId] = useState<string | null | undefined>(undefined)

  /* 답변 알림에서 ?inquiry=<id> 로 넘어온다.
     useSearchParams 대신 window.location.search 를 읽는다 — 이 페이지는 정적
     프리렌더 대상이라 useSearchParams 를 쓰면 Suspense 경계가 필요해진다.
     lazy 초기화라 렌더 중 setState 가 없다(react-hooks/set-state-in-effect 회피). */
  const [target] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('inquiry'))
  const shownId = openId === undefined ? target : openId

  useEffect(() => {
    if (!user) { setLoading(false); return }
    getMyContactMessages(user.id).then(data => { setItems(data); setLoading(false) })
  }, [user, refreshKey])

  // 목록이 그려진 뒤 해당 문의로 스크롤. setState 가 없어 effect 로 둬도 된다.
  useEffect(() => {
    if (!target || items.length === 0) return
    document.getElementById('inquiry-' + target)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [target, items.length])

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
            const open = shownId === m.id
            return (
              <Fragment key={m.id}>
                <tr id={'inquiry-' + m.id} className={styles.row} onClick={() => setOpenId(open ? null : m.id)}>
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