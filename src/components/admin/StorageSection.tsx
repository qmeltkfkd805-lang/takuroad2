'use client'

import { useState } from 'react'
import AdminIcon from './AdminIcon'

/* 관리자 대시보드 — Storage 삭제 후보 점검 (읽기 전용)

   삭제 버튼은 없다. 참조 출처 목록에서 컬럼 하나가 빠지면 살아 있는 파일이
   후보로 잡히므로(조사 중 goods_item_images 를 빠뜨려 굿즈 사진 6장을 지울
   뻔했다) 판단과 삭제는 사람이 한다.

   세 가지 상태를 구분한다
     · 검사 불가   조회 자체가 실패. "후보 0건" 이 아니다
     · 잠정        해석 못 한 참조 값이 있다. 후보 수는 참고값이며
                   삭제해도 되는 목록이 아니다
     · 확정        해석 실패 0. 이때만 "참조 없는 파일이 없습니다" 를 말한다

   자동으로 불러오지 않는다
     참조 컬럼 전수와 storage.objects 전수를 대조하는 조회라 대시보드를 열
     때마다 돌릴 일이 아니다. 버튼을 눌러야 검사한다. */

interface BucketRow {
  bucket: string
  objects: number
  bytes: number
  candidates: number
  candidateBytes: number
  heldRecent: number
  heldRecentBytes: number
  pathsSuppressed: boolean
  sample: { path: string; bytes: number; created: string }[]
}

interface Report {
  ok?: boolean
  error?: string
  detail?: string
  checkFailed?: boolean
  generatedAt?: string
  recentHours?: number
  complete?: boolean
  provisional?: boolean
  unparseableCount?: number
  unparseableSamples?: { source: string; why: string }[]
  sourceCount?: number
  scannedValues?: number
  referenceKeyCount?: number
  totals?: {
    objects: number
    bytes: number
    candidates: number
    candidateBytes: number
    heldRecent: number
    heldRecentBytes: number
  }
  buckets?: BucketRow[]
}

function mib(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB'
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB'
}

export default function StorageSection() {
  const [busy, setBusy] = useState(false)
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setBusy(true)
    setError(null)
    setReport(null)
    try {
      const res = await fetch('/api/admin/storage-orphans')
      const data: Report = await res.json()
      if (!res.ok) {
        setError((data.error ?? '조회 실패') + (data.detail ? ' — ' + data.detail : ''))
        return
      }
      setReport(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류')
    } finally {
      setBusy(false)
    }
  }

  const provisional = report?.provisional === true
  const totals = report?.totals

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 16, background: 'var(--surface)', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 4 }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: 'var(--text)' }}>Storage 삭제 후보</h2>
        {report?.generatedAt && (
          <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>
            {new Date(report.generatedAt).toLocaleString('ko-KR')} 기준
          </span>
        )}
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 12px', lineHeight: 1.6 }}>
        어느 테이블에서도 참조하지 않는 파일을 찾습니다. 삭제는 하지 않습니다 — 목록을 확인한 뒤
        Supabase 대시보드에서 직접 지워주세요.
      </p>

      <button
        type="button"
        onClick={run}
        disabled={busy}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          height: 38, padding: '0 14px',
          border: '1px solid var(--border)', borderRadius: 8,
          background: 'var(--surface)', color: 'var(--text)',
          fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700,
          cursor: busy ? 'default' : 'pointer',
          opacity: busy ? 0.6 : 1,
        }}
      >
        <AdminIcon name="refresh" size={16} />
        {busy ? '검사 중…' : '검사하기'}
      </button>

      {/* 조회 실패 — "후보 0건" 과 전혀 다른 상태다 */}
      {error && (
        <div style={{
          marginTop: 12, padding: '12px 14px', borderRadius: 8,
          background: 'var(--red-l, #fdecec)', color: 'var(--red, #dc2626)',
          fontSize: 13.5, lineHeight: 1.6,
        }}>
          <strong>검사 불가</strong> — {error}
          <div style={{ fontWeight: 400, marginTop: 4 }}>
            조회에 실패했습니다. 참조 없는 파일이 없다는 뜻이 아닙니다.
          </div>
        </div>
      )}

      {report && (
        <div style={{ marginTop: 14 }}>
          {/* 잠정 — 숫자는 보여주되 확정으로 읽히지 않게 한다 */}
          {provisional && (
            <div style={{
              padding: '12px 14px', borderRadius: 9, marginBottom: 12,
              border: '1px solid #f0b429', background: '#fff8e6',
              fontSize: 13, lineHeight: 1.65, color: '#7a5200',
            }}>
              <strong>잠정 결과</strong> — 참조 값 {report.unparseableCount ?? 0}건을 해석하지 못했습니다.
              아래 후보 수는 참고값이며, <strong>삭제해도 되는 목록이 아닙니다.</strong>
              해석 못 한 값이 실제 참조일 수 있습니다.
              {(report.unparseableSamples ?? []).length > 0 && (
                <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                  {(report.unparseableSamples ?? []).map((s, i) => (
                    <li key={i}>{s.source} — {s.why}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* 요약 */}
          {totals && (
            <div style={{
              display: 'grid', gap: 10, marginBottom: 12,
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            }}>
              <Box label="전체 객체" value={totals.objects.toLocaleString() + '개'} sub={mib(totals.bytes)} />
              <Box
                label={provisional ? '삭제 후보 (잠정)' : '삭제 후보'}
                value={totals.candidates.toLocaleString() + '개' + (provisional ? ' (잠정)' : '')}
                sub={mib(totals.candidateBytes)}
                warn={provisional || totals.candidates > 0}
              />
              <Box
                label={'판정 보류 (최근 ' + (report.recentHours ?? 24) + '시간)'}
                value={totals.heldRecent.toLocaleString() + '개'}
                sub={mib(totals.heldRecentBytes)}
              />
              <Box
                label="참조 검사 규모"
                value={(report.sourceCount ?? 0) + '개 출처'}
                sub={'참조 키 ' + (report.referenceKeyCount ?? 0).toLocaleString()
                     + ' · 값 ' + (report.scannedValues ?? 0).toLocaleString() + ' 건 검사'}
              />
            </div>
          )}

          {/* 버킷별 */}
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <Th>버킷</Th>
                <Th right>객체</Th>
                <Th right>용량</Th>
                <Th right>{provisional ? '삭제 후보 (잠정)' : '삭제 후보'}</Th>
                <Th right>보류</Th>
              </tr>
            </thead>
            <tbody>
              {(report.buckets ?? []).map(b => (
                <tr key={b.bucket}>
                  <Td>
                    {b.bucket}
                    {b.pathsSuppressed && (
                      <span style={{ fontSize: 11.5, color: 'var(--muted)', marginLeft: 6 }}>경로 비표시</span>
                    )}
                  </Td>
                  <Td right>{b.objects.toLocaleString()}</Td>
                  <Td right>{mib(b.bytes)}</Td>
                  <Td right>
                    {b.candidates === 0
                      ? <span style={{ color: provisional ? 'var(--warn, #d97706)' : undefined }}>0</span>
                      : <strong style={{ color: 'var(--warn, #d97706)' }}>
                          {b.candidates.toLocaleString()} ({mib(b.candidateBytes)})
                        </strong>}
                  </Td>
                  <Td right>{b.heldRecent > 0 ? b.heldRecent.toLocaleString() : '—'}</Td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* 후보 경로 — 증빙 버킷은 API 가 애초에 sample 을 채우지 않는다 */}
          {(report.buckets ?? []).some(b => (b.sample ?? []).length > 0) && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                후보 경로 (버킷별 용량 상위 20개){provisional ? ' — 잠정' : ''}
              </div>
              {(report.buckets ?? []).filter(b => (b.sample ?? []).length > 0).map(b => (
                <div key={b.bucket} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--muted)', marginBottom: 4 }}>
                    {b.bucket}
                  </div>
                  <ul style={{
                    margin: 0, paddingLeft: 18, fontSize: 12,
                    lineHeight: 1.7, wordBreak: 'break-all', color: 'var(--text)',
                  }}>
                    {(b.sample ?? []).map(s => (
                      <li key={s.path}>
                        {s.path}
                        <span style={{ color: 'var(--muted)' }}>
                          {' — ' + mib(s.bytes) + ' · ' + new Date(s.created).toLocaleDateString('ko-KR')}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {/* 확정일 때만 "없다" 고 말한다 */}
          {!provisional && (totals?.candidates ?? 0) === 0 && (
            <div style={{
              marginTop: 12, display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 13, color: 'var(--muted)',
            }}>
              <AdminIcon name="checkCircle" size={16} />
              참조 없는 파일이 없습니다. 검사는 완전하게 끝났습니다.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── 조각들 ─────────────────────────────────────────── */

function Box({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '11px 12px' }}>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 5 }}>{label}</div>
      <div style={{
        fontSize: 19, fontWeight: 900, lineHeight: 1.2,
        color: warn ? 'var(--warn, #d97706)' : 'var(--text)',
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3, wordBreak: 'break-all' }}>{sub}</div>
      )}
    </div>
  )
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th style={{
      textAlign: right ? 'right' : 'left',
      fontSize: 12, fontWeight: 700, color: 'var(--muted)',
      padding: '0 8px 8px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
    }}>
      {children}
    </th>
  )
}

function Td({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <td style={{
      textAlign: right ? 'right' : 'left',
      fontSize: 13.5, padding: '9px 8px',
      borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
    }}>
      {children}
    </td>
  )
}
