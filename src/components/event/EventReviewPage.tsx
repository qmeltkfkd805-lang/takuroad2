'use client'

import { useState } from 'react'
import WorkEventList from '@/components/work/WorkEventList'
import { WorkEvent } from '@/services/eventService'

const TYPE_LABEL: Record<string, string> = {
  popup: '🎪 팝업스토어', collab_cafe: '☕ 콜라보 카페', exhibition: '🖼️ 전시',
}

interface Submission {
  id: string
  title: string
  tagName: string
  tagId: string
  type: string
  placeName: string
  placeDetail: string | null
  startDate: string | null
  endDate: string | null
  sourceUrl: string
  description: string | null
  submittedBy: string
  createdAt: string
}

const SAMPLE: Submission[] = [
  {
    id: 's1', title: '블루아카이브 × 애니메이트 콜라보 카페', tagName: '블루 아카이브', tagId: 't1',
    type: 'collab_cafe', placeName: '애니메이트 홍대', placeDetail: '3층',
    startDate: '2026-07-01', endDate: '2026-07-31',
    sourceUrl: 'https://x.com/example/status/123', description: '캐릭터별 음료 + 특전 코스터 증정',
    submittedBy: '덕질러123', createdAt: '2026-06-24T09:00:00Z',
  },
  {
    id: 's2', title: '원피스 팝업스토어 ', tagName: '원피스', tagId: 't2',
    type: 'popup', placeName: '더현대서울', placeDetail: '5층',
    startDate: '2026-06-28', endDate: '2026-07-14',
    sourceUrl: 'https://example.com/onepiece-popup', description: null,
    submittedBy: '루피팬', createdAt: '2026-06-24T10:30:00Z',
  },
]

function fmtPeriod(s: string | null, e: string | null): string {
  if (!s && !e) return '기간 미정'
  const f = (d: string) => d.replace(/-/g, '.').slice(2)
  if (s && e) return `${f(s)} ~ ${f(e)}`
  return f((s ?? e)!)
}

export default function EventReviewPage() {
  const [queue, setQueue] = useState<Submission[]>(SAMPLE)

  function removeFromQueue(id: string) {
    setQueue(q => q.filter(x => x.id !== id))
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
function ReviewCard({ submission, onDone }: { submission: Submission; onDone: () => void }) {
  // 제보 값으로 시작하되, 관리자가 수정 가능
  const [title, setTitle] = useState(submission.title.trim())
  const [type, setType] = useState(submission.type)
  const [placeName, setPlaceName] = useState(submission.placeName)
  const [placeDetail, setPlaceDetail] = useState(submission.placeDetail ?? '')
  const [startDate, setStartDate] = useState(submission.startDate ?? '')
  const [endDate, setEndDate] = useState(submission.endDate ?? '')
  const [description, setDescription] = useState(submission.description ?? '')

  // 미리보기 — 수정한 값이 실시간 반영
  const preview: WorkEvent = {
    id: submission.id, tagId: submission.tagId, type, shopId: null,
    title, createdAt: submission.createdAt,
  }

  function approve() {
    const event = {
      tag_id: submission.tagId, type, title,
      place: placeName, place_detail: placeDetail || null,
      start_date: startDate || null, end_date: endDate || null,
      description: description || null,
    }
    console.log('[승인] Event 생성:', event)
    alert(`승인됨: "${title}" → Event 생성 (아직 저장 안 됨)`)
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
      {/* 메타: 제보자 + 출처 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
       <span style={{ fontSize: '12px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          제보 <b style={{ color: 'var(--text)' }}>{submission.submittedBy}</b>
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

        <EditField label="장소">
          <input value={placeName} onChange={e => setPlaceName(e.target.value)} style={inputStyle} />
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

      {/* 미리보기 — 작품 홈 + 샵 상세 */}
      <div style={{ padding: '14px 16px', background: 'var(--surface2)', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)', marginBottom: '8px' }}>
          👁️ 승인 후 — 작품 홈 「새로운 소식」
        </div>
        <WorkEventList events={[preview]} />

        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)', margin: '14px 0 8px' }}>
          👁️ 승인 후 — {placeName} 「진행 중인 이벤트」
        </div>
        {/* 샵 상세용 표시는 아직 정식 컴포넌트 없음 → 미리보기 스케치 (나중에 ShopEventList로 승격) */}
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
          수정 내용으로 승인 → Event 생성
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

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 'var(--r-sm)',
  border: '1px solid var(--border)', background: 'var(--surface)',
  fontSize: '14px', color: 'var(--text)', fontFamily: 'inherit', boxSizing: 'border-box',
}