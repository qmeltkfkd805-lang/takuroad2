'use client'

import { useState } from 'react'

// 관리자 대시보드용 — 전체 유저 배지 재평가 트리거.
// 새 배지를 심은 뒤 기존 유저에게 소급 지급할 때 누른다.
/* 배지는 들어갔는데 보너스 EXP 만 실패하는 "부분 성공"이 있다.
   둘은 원자적으로 처리되지 않으므로 그 상태를 숨기지 않고 그대로 보여준다.
   다시 눌러도 이미 준 배지·EXP 는 중복되지 않고 빠진 것만 채워진다. */
interface ExpFailure { userId: string; tierName: string; exp: number; message: string }
interface EvalFailure { userId: string; tierName: string; stage: string; message: string }
interface ReevalResponse {
  error?: string
  partial?: boolean
  usersProcessed?: number
  totalGranted?: number
  expGranted?: number
  expFailed?: number
  expFailures?: ExpFailure[]
  evalFailures?: EvalFailure[]
}

export default function BadgeReevalButton() {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [warn, setWarn] = useState<string[]>([])

  async function run() {
    const ok = confirm(
      '모든 유저의 배지를 다시 평가합니다.\n' +
      '이미 가진 배지는 그대로 유지되고, 새로 조건을 채운 배지만 추가돼요.\n\n' +
      '진행할까요?'
    )
    if (!ok) return
    setBusy(true)
    setResult(null)
    setWarn([])
    try {
      const res = await fetch('/api/admin/reevaluate-badges', { method: 'POST' })
      const data: ReevalResponse = await res.json()
      if (!res.ok) {
        setResult('실패: ' + (data.error ?? res.status))
        return
      }

      setResult(
        '완료 - 유저 ' + data.usersProcessed + '명 검사, 새 배지 ' + data.totalGranted + '개 지급'
        + ', 보너스 EXP ' + (data.expGranted ?? 0) + '건 지급'
      )

      if (data.partial) {
        const lines: string[] = []
        if ((data.expFailed ?? 0) > 0) {
          lines.push(
            '배지는 지급됐지만 보너스 EXP ' + data.expFailed + '건이 실패했어요. '
            + '다시 눌러도 중복 지급되지 않고 빠진 것만 채워집니다.'
          )
          for (const f of (data.expFailures ?? []).slice(0, 5)) {
            lines.push('· ' + f.tierName + ' (' + f.exp + ' EXP) — ' + f.message)
          }
        }
        for (const f of (data.evalFailures ?? []).slice(0, 5)) {
          lines.push('· 평가 실패: ' + f.tierName + ' [' + f.stage + '] — ' + f.message)
        }
        setWarn(lines)
      }
    } catch (e) {
      setResult('오류: ' + (e instanceof Error ? e.message : '알 수 없음'))
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
      {warn.length > 0 && (
        <div
          style={{
            marginTop: 8, padding: '10px 12px', borderRadius: 9,
            border: '1px solid #f0b429', background: '#fff8e6',
            fontSize: 12.5, lineHeight: 1.6, color: '#7a5200',
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}
        >
          {warn.map((line, i) => <div key={i}>{line}</div>)}
        </div>
      )}
    </div>
  )
}