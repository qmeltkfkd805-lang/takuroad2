'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { createSuggestion } from '@/services/suggestionService'
import AppIcon from '@/components/tds/AppIcon'
import styles from '@/components/contact/ContactForm.module.css'   // 문의하기와 같은 디자인 재사용

export default function SuggestForm() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const [sentId, setSentId] = useState<string | null>(null)

  if (sentId) {
    return (
      <div className={styles.done}>
        <div className={styles.doneIcon}><AppIcon name="check" size={28} color="#fff" /></div>
        <h3 className={styles.doneTitle}>제안이 접수되었어요</h3>
        <p className={styles.doneDesc}>소중한 아이디어 고마워요. 하나하나 읽고 반영을 검토할게요.</p>
        <span className={styles.doneId}>#{sentId.slice(0, 8)}</span>
      </div>
    )
  }

  if (!loading && !user) {
    return (
      <div style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--muted)' }}>
        <p style={{ marginBottom: 16, fontSize: 14 }}>제안을 남기려면 로그인이 필요해요.</p>
        <button
          onClick={() => router.push('/login?redirect=/support/suggest')}
          style={{ padding: '11px 22px', borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}
        >로그인하기</button>
      </div>
    )
  }

  const canSubmit = title.trim().length > 0 && content.trim().length > 0

  async function submit() {
    if (!canSubmit || sending) return
    setSending(true)
    const res = await createSuggestion(title, content)
    setSending(false)
    if (res.ok && res.id) setSentId(res.id)
    else alert('전송에 실패했어요. 잠시 후 다시 시도해 주세요.')
  }

  return (
    <div className={styles.form}>
      <div className={styles.field} style={{ marginTop: 0 }}>
        <label className={styles.label}>제목<em className={styles.req}>*</em></label>
        <input
          className={styles.input}
          placeholder="예: 방문한 샵을 지도에서 한눈에 보고 싶어요"
          value={title}
          onChange={e => setTitle(e.target.value)}
          maxLength={80}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>내용<em className={styles.req}>*</em></label>
        <textarea
          className={styles.textarea}
          rows={7}
          placeholder="어떤 기능이 왜 있으면 좋을지 자유롭게 적어주세요."
          value={content}
          onChange={e => setContent(e.target.value)}
          maxLength={2000}
        />
      </div>

      <button type="button" className={styles.submit} disabled={!canSubmit || sending} onClick={submit}>
        {sending ? '보내는 중…' : '제안 보내기'}
      </button>
    </div>
  )
}
