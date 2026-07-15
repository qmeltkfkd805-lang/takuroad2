'use client'

import { useState } from 'react'

// 관리자 대시보드용 — 전체 유저 배지 재평가 트리거.
// 새 배지를 심은 뒤 기존 유저에게 소급 지급할 때 누른다.
export default function BadgeReevalButton() {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function run() {
    const ok = confirm(
      '모든 유저의 배지를 다시 평가합니다.\n' +
      '이미 가진 배지는 그대로 유지되고, 새로 조건을 채운 배지만 추가돼요.\n\n' +
      '진행할까요?'
    )
    if (!ok) return
    setBusy(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/reevaluate-badges', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setResult('실패: ' + (data.error ?? res.status))
      } else {
        setResult('완료 - 유저 ' + data.usersProcessed + '명 검사, 새 배지 ' + data.totalGranted + '개 지급')
      }
    } catch (e: any) {
      setResult('오류: ' + (e?.message ?? '알 수 없음'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ margin: '4px 0 24px', padding: 14, border: '1px solid var(--border)', borderRadius: 12 }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>배지 재평가</div>
      <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 10, lineHeight: 1.5 }}>
        새 배지를 추가한 뒤 눌러 기존 유저에게 소급 지급합니다. 이미 가진 배지는 유지돼요.
      </div>
      <button
        onClick={run}
        disabled={busy}
        style={{
          padding: '9px 16px', fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
          borderRadius: 9, border: 'none', color: '#fff',
          cursor: busy ? 'default' : 'pointer',
          background: busy ? 'var(--muted)' : 'var(--accent)',
        }}
      >
        {busy ? '재평가 중...' : '전체 유저 배지 재평가'}
      </button>
      {result && (
        <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text)' }}>{result}</div>
      )}
    </div>
  )
}