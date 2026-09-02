'use client'
import { useState, useEffect } from 'react'
import { getAllSuggestions, updateSuggestion, rewardSuggestionExp, SUGGESTION_STATUS } from '@/services/suggestionService'

const STATUS_LABEL: Record<string, string> = Object.fromEntries(SUGGESTION_STATUS.map(s => [s.key, s.label]))
const FILTERS = [{ key: 'all', label: '전체' }, ...SUGGESTION_STATUS]

export default function SuggestionAdminTab() {
  const [filter, setFilter] = useState<string>('all')
  const [rows, setRows] = useState<any[]>([])
  // 어떤 필터의 결과를 갖고 있는지로 로딩 여부를 판단한다 (effect 안에서 곧바로 setState 하지 않기 위해)
  const [loadedFilter, setLoadedFilter] = useState<string | null>(null)
  const ready = loadedFilter === filter

  useEffect(() => {
    let alive = true
    getAllSuggestions(filter)
      .then(data => { if (alive) { setRows(data); setLoadedFilter(filter) } })
      .catch(() => { if (alive) { setRows([]); setLoadedFilter(filter) } })
    return () => { alive = false }
  }, [filter])

  async function changeStatus(id: string, status: string) {
    await updateSuggestion(id, { status })
    setRows(prev => prev.map(r => (r.id === id ? { ...r, status } : r)))
  }
  async function saveNote(id: string, adminNote: string) {
    await updateSuggestion(id, { adminNote })
    setRows(prev => prev.map(r => (r.id === id ? { ...r, admin_note: adminNote } : r)))
  }
  async function saveReply(id: string, reply: string) {
    await updateSuggestion(id, { reply })
    setRows(prev => prev.map(r => (r.id === id ? { ...r, reply } : r)))
  }
  async function reward(r: any, amount: number) {
    if (!r.user_id) return
    if (!window.confirm(`${r.nickname ?? '이 제안자'}에게 경험치 +${amount}를 지급할까요?`)) return
    const res = await rewardSuggestionExp(r.id, r.user_id, amount, r.reward_exp ?? 0)
    if (res.ok) setRows(prev => prev.map(x => (x.id === r.id ? { ...x, reward_exp: (x.reward_exp ?? 0) + amount } : x)))
    else window.alert('경험치 지급에 실패했어요.')
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
        {FILTERS.map(s => (
          <button key={s.key} onClick={() => setFilter(s.key)}
            style={{
              padding: '6px 12px', borderRadius: 9999, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 13,
              border: '1px solid ' + (filter === s.key ? 'var(--accent)' : 'var(--border)'),
              background: filter === s.key ? 'var(--accent-l)' : 'var(--surface)',
              color: filter === s.key ? 'var(--accent)' : 'var(--muted)',
            }}>{s.label}</button>
        ))}
      </div>

      {!ready ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>불러오는 중...</div>
      ) : rows.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>제안이 없어요</div>
      ) : (
        rows.map(r => (
          <div key={r.id} style={{ padding: 16, borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
              <b style={{ fontSize: 15 }}>{r.title}</b>
              <span style={{ fontSize: 12, color: 'var(--muted)', flexShrink: 0 }}>{new Date(r.created_at).toLocaleDateString('ko-KR')}</span>
            </div>
            <p style={{ fontSize: 13.5, color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: '0 0 8px' }}>{r.content}</p>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
              제안자: {r.nickname ?? (r.user_id ? r.user_id.slice(0, 8) : '알 수 없음')} · 상태: <b style={{ color: 'var(--accent)' }}>{STATUS_LABEL[r.status] ?? r.status}</b>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {SUGGESTION_STATUS.map(s => (
                <button key={s.key} onClick={() => changeStatus(r.id, s.key)}
                  style={{
                    padding: '5px 10px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 12,
                    border: '1px solid ' + (r.status === s.key ? 'var(--accent)' : 'var(--border)'),
                    background: r.status === s.key ? 'var(--accent)' : 'var(--surface)',
                    color: r.status === s.key ? '#fff' : 'var(--muted)',
                  }}>{s.label}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>제안 채택 보상:</span>
              {[30, 50, 100].map(a => (
                <button key={a} disabled={!r.user_id} onClick={() => reward(r, a)}
                  style={{
                    padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)',
                    color: r.user_id ? 'var(--accent)' : 'var(--muted)', fontWeight: 700, fontSize: 12,
                    cursor: r.user_id ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
                  }}>EXP +{a}</button>
              ))}
              {(r.reward_exp ?? 0) > 0 && <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)' }}>지급됨 +{r.reward_exp}</span>}
              {!r.user_id && <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>(탈퇴/익명 사용자 — 지급 불가)</span>}
            </div>

            <Editor
              label="답변 / 반려 사유 (제안자에게 표시됨)"
              initial={r.reply ?? ''}
              placeholder="반려 사유나 안내를 적으면 제안자 화면에 그대로 보여요"
              onSave={v => saveReply(r.id, v)}
            />
            <Editor
              label="관리자 메모 (내부용 · 제안자에게 안 보임)"
              initial={r.admin_note ?? ''}
              placeholder="내부 메모"
              onSave={v => saveNote(r.id, v)}
            />
          </div>
        ))
      )}
    </div>
  )
}

function Editor({ label, initial, placeholder, onSave }: { label: string; initial: string; placeholder: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(initial)
  const [saved, setSaved] = useState(false)
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <textarea
          value={v}
          onChange={e => { setV(e.target.value); setSaved(false) }}
          rows={2}
          placeholder={placeholder}
          style={{ flex: 1, border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--text)', resize: 'vertical', boxSizing: 'border-box' }}
        />
        <button onClick={() => { onSave(v); setSaved(true) }}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
          {saved ? '저장됨' : '저장'}
        </button>
      </div>
    </div>
  )
}
