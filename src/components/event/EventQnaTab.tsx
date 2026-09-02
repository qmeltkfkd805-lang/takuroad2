'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import {
  EventQna, getEventQna, createEventQuestion, answerEventQuestion, deleteEventQuestion,
} from '@/services/eventQnaService'

const fmt = (s: string) => {
  const d = new Date(s)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

export default function EventQnaTab({ eventId, onCountChange }: { eventId: string; onCountChange?: (n: number) => void }) {
  const { user, isAdmin } = useAuth()
  const router = useRouter()
  const [rows, setRows] = useState<EventQna[]>([])
  const [loading, setLoading] = useState(true)
  const [question, setQuestion] = useState('')
  const [saving, setSaving] = useState(false)
  const [answering, setAnswering] = useState<string | null>(null)
  const [answerText, setAnswerText] = useState('')

  const load = async () => {
    const list = await getEventQna(eventId)
    setRows(list)
    onCountChange?.(list.length)
    setLoading(false)
  }
  useEffect(() => { load()   }, [eventId])

  const ask = async () => {
    if (!user) { router.push('/login'); return }
    if (!question.trim()) return
    setSaving(true)
    const ok = await createEventQuestion(eventId, user.id, question.trim())
    setSaving(false)
    if (ok) { setQuestion(''); load() }
  }

  const submitAnswer = async (id: string) => {
    if (!user || !answerText.trim()) return
    if (await answerEventQuestion(id, user.id, answerText.trim())) {
      setAnswering(null); setAnswerText(''); load()
    }
  }

  const remove = async (id: string) => {
    if (!confirm('삭제할까요?')) return
    if (await deleteEventQuestion(id)) load()
  }

  return (
    <div>
      {/* 질문 작성 */}
      <div style={{ background: 'var(--surface2)', borderRadius: 14, padding: 16, marginBottom: 20 }}>
        <textarea
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder={user ? '이벤트에 대해 궁금한 점을 물어보세요.' : '로그인하고 질문을 남겨보세요.'}
          rows={2}
          maxLength={1000}
          style={{
            width: '100%', border: '1px solid var(--border)', borderRadius: 10,
            padding: 12, fontSize: 13.5, fontFamily: 'inherit', resize: 'vertical',
            background: 'var(--surface)', color: 'var(--text)',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
          <button
            onClick={ask}
            disabled={saving || !question.trim()}
            style={{
              border: 'none', borderRadius: 10, padding: '10px 20px', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 800,
              background: 'var(--accent)', color: '#fff', opacity: saving || !question.trim() ? .5 : 1,
            }}
          >
            {saving ? '등록 중…' : '질문하기'}
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>불러오는 중…</div>
      ) : rows.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, padding: '20px 0' }}>
          아직 질문이 없어요. 궁금한 걸 먼저 물어보세요.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {rows.map(q => (
            <div key={q.id} style={{ padding: '18px 0', borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={qBadge}>Q</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13.5, lineHeight: 1.7, margin: '0 0 6px', whiteSpace: 'pre-wrap' }}>{q.question}</p>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {q.asker?.nickname ?? '알 수 없음'} · {fmt(q.createdAt)}
                    {(user?.id === q.userId || isAdmin) && (
                      <button onClick={() => remove(q.id)} style={linkBtn}>삭제</button>
                    )}
                  </div>
                </div>
              </div>

              {q.answer ? (
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 14, marginLeft: 20, padding: 14, background: 'var(--surface2)', borderRadius: 12 }}>
                  <span style={aBadge}>A</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13.5, lineHeight: 1.7, margin: '0 0 6px', whiteSpace: 'pre-wrap' }}>{q.answer}</p>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {q.answerer?.nickname ?? '운영자'}{q.answeredAt ? ` · ${fmt(q.answeredAt)}` : ''}
                    </div>
                  </div>
                </div>
              ) : isAdmin ? (
                answering === q.id ? (
                  <div style={{ marginTop: 12, marginLeft: 20 }}>
                    <textarea
                      value={answerText}
                      onChange={e => setAnswerText(e.target.value)}
                      rows={2}
                      placeholder="답변을 입력하세요"
                      style={{
                        width: '100%', border: '1px solid var(--border)', borderRadius: 10,
                        padding: 12, fontSize: 13.5, fontFamily: 'inherit', resize: 'vertical',
                      }}
                    />
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button onClick={() => submitAnswer(q.id)} style={{ ...smallBtn, background: 'var(--accent)', color: '#fff', border: 'none' }}>등록</button>
                      <button onClick={() => { setAnswering(null); setAnswerText('') }} style={smallBtn}>취소</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => { setAnswering(q.id); setAnswerText('') }} style={{ ...smallBtn, marginTop: 10, marginLeft: 20 }}>
                    답변 달기
                  </button>
                )
              ) : (
                <div style={{ marginTop: 10, marginLeft: 20, fontSize: 12.5, color: 'var(--muted)' }}>아직 답변이 없어요.</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const qBadge: React.CSSProperties = {
  width: 22, height: 22, borderRadius: 7, flexShrink: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 800,
}
const aBadge: React.CSSProperties = { ...qBadge, background: '#8B6BD9' }

const linkBtn: React.CSSProperties = {
  border: 'none', background: 'none', padding: 0, marginLeft: 10,
  cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, color: 'var(--muted)',
}
const smallBtn: React.CSSProperties = {
  padding: '8px 14px', borderRadius: 9, border: '1px solid var(--border)',
  background: 'var(--surface)', cursor: 'pointer', fontFamily: 'inherit',
  fontSize: 12.5, fontWeight: 700, color: 'var(--text)',
}
