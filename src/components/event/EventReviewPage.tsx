'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/layout/AuthProvider'
import WorkEventList from '@/components/work/WorkEventList'
import { WorkEvent } from '@/services/eventService'
import { getPendingSubmissions, PendingSubmission } from '@/services/eventSubmissionService'

const TYPE_LABEL: Record<string, string> = {
  popup: '🎪 팝업스토어', collab_cafe: '☕ 콜라보 카페', exhibition: '🖼️ 전시',
}

function fmtPeriod(s: string | null, e: string | null): string {
  if (!s && !e) return '기간 미정'
  const f = (d: string) => d.replace(/-/g, '.').slice(2)
  if (s && e) return `${f(s)} ~ ${f(e)}`
  return f((s ?? e)!)
}

export default function EventReviewPage() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const [queue, setQueue] = useState<PendingSubmission[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!isAdmin) { setLoading(false); return }
    getPendingSubmissions().then(setQueue).finally(() => setLoading(false))
  }, [authLoading, isAdmin])

  function removeFromQueue(id: string) {
    setQueue(q => q.filter(x => x.id !== id))
  }

  if (authLoading || loading) {
    return <Centered>불러오는 중...</Centered>
  }
  if (!isAdmin) {
    return <Centered>관리자만 접근할 수 있어요.</Centered>
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', padding: '16px', maxWidth: '680px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text)', margin: '4px 0 6px' }}>
        🛡️ 이벤트 제보 검수
      </h1>
      <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '0 0 20px' }}>
        검수 대기 {queue.length}건 · 수정 후 승인할 수 있어요
      </p>

      {queue.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)',
          background: 'var(--surface2)', borderRadius: 'var(--r-sm)' }}>
          검수할 제보가 없어요
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {queue.map(s => (
            <ReviewCard key={s.id} submission={s} onDone={() => removeFromQueue(s.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

// 제보 한 건 = Event 생성 에디터
function ReviewCard({ submission, onDone }: { submission: PendingSubmission; onDone: () => void }) {
  const snap = submission.placeSnapshot ?? {}
  const snapName = snap.name ?? '(장소 정보 없음)'
  const snapAddr = snap.roadAddress ?? snap.address ?? ''

  // 제보 값으로 시작하되, 관리자가 수정 가능
  const [title, setTitle] = useState(submission.title.trim())
  const [type, setType] = useState(submission.type)
  const [placeDetail, setPlaceDetail] = useState(submission.placeDetail ?? '')
  const [startDate, setStartDate] = useState(submission.startDate ?? '')
  const [endDate, setEndDate] = useState(submission.endDate ?? '')
  const [description, setDescription] = useState(submission.description ?? '')

  // 미리보기 — 수정한 값 실시간 반영
  const preview: WorkEvent = {
    id: submission.id, tagId: submission.tagId, type, shopId: null,
    title, createdAt: submission.createdAt,
  }

  function approve() {
    console.log('[승인 예정]', { tag_id: submission.tagId, type, title, snapshot: snap })
    alert(`승인됨: "${title}" (Event 생성/장소 연결은 다음 단계)`)
    onDone()
  }
  function reject() {
    const reason = prompt('반려 사유를 입력하세요')
    if (reason === null) return
    console.log('[반려]', submission.id, reason)
    onDone()
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r)', background: 'var(--surface)', overflow: 'hidden' }}>
      {/* 메타: 제보자 + 작품 + 출처 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
        padding: '12px 16px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          제보 <b style={{ color: 'var(--text)' }}>{submission.submitterName}</b>
          <a href={`/work/${submission.tagId}`} target="_blank" rel="noopener noreferrer"
            style={{ color: 'var(--purple)', fontWeight: 700, textDecoration: 'none' }}>
            🎮 {submission.tagName} ↗
          </a>
        </span>
        <a href={submission.sourceUrl} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: '13px', color: '#fff', background: 'var(--purple)', fontWeight: 700,
            padding: '6px 12px', borderRadius: 'var(--r-sm)', textDecoration: 'none' }}>
          🔗 출처 확인
        </a>
      </div>

      {/* 에디터 */}
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <EditField label="이벤트명">
          <input value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} />
        </EditField>

        <EditField label="종류">
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {Object.entries(TYPE_LABEL).map(([v, label]) => (
              <button key={v} onClick={() => setType(v)}
                style={{ padding: '8px 12px', borderRadius: 'var(--r-sm)', cursor: 'pointer',
                  border: `1.5px solid ${type === v ? 'var(--accent)' : 'var(--border)'}`,
                  background: type === v ? 'var(--surface2)' : 'var(--surface)',
                  color: 'var(--text)', fontSize: '12px', fontWeight: 700, fontFamily: 'inherit' }}>
                {label}
              </button>
            ))}
          </div>
        </EditField>

        {/* 장소 — 제보자가 고른 카카오 장소(주장). 검수 때 shop으로 정리 (다음 단계) */}
        <EditField label="장소 (제보자가 선택)">
          <div style={{ padding: '10px 12px', borderRadius: 'var(--r-sm)',
            border: '1px dashed var(--border)', background: 'var(--surface2)' }}>
            <div style={{ fontSize: '14px', fontWeight: 700 }}>📍 {snapName}</div>
            {snapAddr && <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{snapAddr}</div>}
            <div style={{ fontSize: '11px', color: 'var(--accent)', marginTop: '4px' }}>
              ⚠ 아직 샵으로 연결되지 않음 (승인 시 연결/생성 — 다음 단계)
            </div>
          </div>
        </EditField>

        <EditField label="상세 위치">
          <input value={placeDetail} onChange={e => setPlaceDetail(e.target.value)}
            placeholder="예: 5층" style={inputStyle} />
        </EditField>

        <EditField label="기간">
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} />
            <span style={{ color: 'var(--muted)' }}>~</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={inputStyle} />
          </div>
        </EditField>

        <EditField label="설명">
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            rows={2} placeholder="(없음)" style={{ ...inputStyle, resize: 'vertical' }} />
        </EditField>
      </div>

      {/* 미리보기 */}
      <div style={{ padding: '14px 16px', background: 'var(--surface2)', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)', marginBottom: '8px' }}>
          👁️ 승인 후 — 작품 홈 「새로운 소식」
        </div>
        <WorkEventList events={[preview]} />

        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)', margin: '14px 0 8px' }}>
          👁️ 승인 후 — {snapName} 「진행 중인 이벤트」
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px',
          borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'var(--surface)' }}>
          <span style={{ fontSize: '20px' }}>{TYPE_LABEL[type]?.split(' ')[0] ?? '✨'}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>{title || '(제목 없음)'}</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
              {fmtPeriod(startDate || null, endDate || null)}{placeDetail ? ` · ${placeDetail}` : ''}
            </div>
          </div>
        </div>
      </div>

      {/* 승인 / 반려 */}
      <div style={{ display: 'flex', gap: '8px', padding: '14px 16px', borderTop: '1px solid var(--border)' }}>
        <button onClick={reject}
          style={{ flex: 1, padding: '12px', borderRadius: 'var(--r-sm)',
            border: '1.5px solid var(--border)', background: 'var(--surface)',
            color: 'var(--red)', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          반려
        </button>
        <button onClick={approve}
          style={{ flex: 2, padding: '12px', borderRadius: 'var(--r-sm)', border: 'none',
            background: 'var(--green)', color: '#fff', fontSize: '14px', fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit' }}>
          수정 내용으로 승인
        </button>
      </div>
    </div>
  )
}

function EditField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--muted)', marginBottom: '5px' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: '14px' }}>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 'var(--r-sm)',
  border: '1px solid var(--border)', background: 'var(--surface)',
  fontSize: '14px', color: 'var(--text)', fontFamily: 'inherit', boxSizing: 'border-box',
}