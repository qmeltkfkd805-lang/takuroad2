'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/components/layout/AuthProvider'
import { getMyContactMessages } from '@/services/contactService'
import { CONTACT_TYPES } from './contactConfig'
import styles from './MyContacts.module.css'

const STATUS: Record<string, { label: string; cls: string }> = {
  pending:    { label: '대기', cls: 'pending' },
  processing: { label: '처리중', cls: 'processing' },
  done:       { label: '답변 완료', cls: 'done' },
}

export default function MyContacts({ refreshKey = 0 }: { refreshKey?: number }) {
  const { user } = useAuth()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

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
            return (
              <tr key={m.id}>
                <td className={styles.type}>{typeLabel(m.type)}</td>
                <td className={styles.subject}>{m.title}</td>
                <td><span className={styles.badge + ' ' + styles[st.cls]}>{st.label}</span></td>
                <td className={styles.date}>{new Date(m.created_at).toLocaleDateString('ko-KR')}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}