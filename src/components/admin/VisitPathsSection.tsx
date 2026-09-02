'use client'
import { useState, useEffect, useMemo } from 'react'
import {
  getTopPaths, getVisitReferrers, getExitPaths, getRecentVisitSessions, getVisitSessionPath,
  TopPathRow, ReferrerRow, ExitPathRow, VisitSessionRow, SessionStep,
} from '@/services/visitAnalyticsService'

/* 방문 경로 분석 — visit_logs 집계. 저장하는 건 없고 읽기만 한다. */

type Tab = 'pages' | 'referrers' | 'exits' | 'sessions'
const TABS: { v: Tab; label: string }[] = [
  { v: 'pages', label: '페이지별' },
  { v: 'referrers', label: '유입 경로' },
  { v: 'exits', label: '이탈 페이지' },
  { v: 'sessions', label: '방문 여정' },
]
// days = 0 은 "오늘"(한국 시간 자정부터). RPC의 visit_window_start가 그렇게 해석한다
const PERIODS: { d: number; label: string }[] = [
  { d: 0, label: '오늘' }, { d: 7, label: '7일' }, { d: 30, label: '30일' }, { d: 90, label: '90일' },
]

export default function VisitPathsSection() {
  const [tab, setTab] = useState<Tab>('pages')
  const [days, setDays] = useState(30)

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 16, marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 900 }}>방문 경로</h4>
        <div style={{ display: 'flex', gap: 6 }}>
          {PERIODS.map(p => (
            <button key={p.d} onClick={() => setDays(p.d)} style={chip(days === p.d)}>{p.label}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.v} onClick={() => setTab(t.v)} style={tabBtn(tab === t.v)}>{t.label}</button>
        ))}
      </div>

      {tab === 'pages' && <PagesTab days={days} />}
      {tab === 'referrers' && <ReferrersTab days={days} />}
      {tab === 'exits' && <ExitsTab days={days} />}
      {tab === 'sessions' && <SessionsTab days={days} />}
    </div>
  )
}

/* ── 페이지별 ─────────────────────────────────────────────── */
function PagesTab({ days }: { days: number }) {
  // 묶어보기: /event/:id 로 합쳐 "어떤 종류의 페이지가 인기인지"
  // 개별보기: 실제 주소 그대로 "어느 이벤트가 인기인지"
  const [grouped, setGrouped] = useState(true)
  const [rows, setRows] = useState<TopPathRow[] | null>(null)

  useEffect(() => {
    let alive = true
    setRows(null)
    getTopPaths(days, grouped, 40).then(r => { if (alive) setRows(r) })
    return () => { alive = false }
  }, [days, grouped])

  const maxPv = useMemo(() => Math.max(1, ...(rows ?? []).map(r => r.pv)), [rows])

  return (
    <>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <button onClick={() => setGrouped(true)} style={chip(grouped)}>묶어보기</button>
        <button onClick={() => setGrouped(false)} style={chip(!grouped)}>개별 주소</button>
      </div>
      <p style={pageHint}>
        {grouped
          ? '이벤트·샵 상세처럼 주소가 매번 다른 페이지를 한 줄로 묶었어요. 어떤 화면이 많이 쓰이는지 볼 때.'
          : '실제 주소 그대로예요. 어떤 이벤트·샵이 인기인지 볼 때.'}
      </p>

      <Rows
        rows={rows}
        empty="아직 방문 기록이 없어요."
        render={r => (
          <Bar key={r.path} label={r.path} ratio={r.pv / maxPv}
            right={<><b>{r.pv.toLocaleString()}</b><Muted> PV · {r.uv.toLocaleString()} UV</Muted></>} />
        )}
      />
    </>
  )
}

/* ── 유입 경로 ────────────────────────────────────────────── */
function ReferrersTab({ days }: { days: number }) {
  const [rows, setRows] = useState<ReferrerRow[] | null>(null)
  useEffect(() => {
    let alive = true
    setRows(null)
    getVisitReferrers(days, 20).then(r => { if (alive) setRows(r) })
    return () => { alive = false }
  }, [days])

  const max = useMemo(() => Math.max(1, ...(rows ?? []).map(r => r.sessions)), [rows])
  const total = useMemo(() => (rows ?? []).reduce((s, r) => s + r.sessions, 0), [rows])

  return (
    <>
      <p style={pageHint}>
        세션의 <b>첫 페이지</b> 기준이에요. 사이트 안에서 이동한 건 빼고, 밖에서 들어온 것만 셉니다. 합계 {total.toLocaleString()}회 방문.
      </p>
      <Rows
        rows={rows}
        empty="아직 방문 기록이 없어요."
        render={r => (
          <Bar key={r.source} label={r.source} sub={r.landingPath ? `주로 ${r.landingPath} 로 들어옴` : undefined}
            ratio={r.sessions / max} muted={r.source === '직접 방문'}
            right={<><b>{r.sessions.toLocaleString()}</b><Muted> · {total ? Math.round((r.sessions / total) * 100) : 0}%</Muted></>} />
        )}
      />
    </>
  )
}

/* ── 이탈 페이지 ──────────────────────────────────────────── */
function ExitsTab({ days }: { days: number }) {
  const [rows, setRows] = useState<ExitPathRow[] | null>(null)
  useEffect(() => {
    let alive = true
    setRows(null)
    getExitPaths(days, 30).then(r => { if (alive) setRows(r) })
    return () => { alive = false }
  }, [days])

  const max = useMemo(() => Math.max(1, ...(rows ?? []).map(r => r.exits)), [rows])

  return (
    <>
      <p style={pageHint}>
        방문자가 <b>마지막으로 본 페이지</b>예요. “직행”은 그 페이지 하나만 보고 바로 나간 경우라, 높으면 그 페이지에서 다음 행동이 안 이어진다는 뜻이에요.
      </p>
      <Rows
        rows={rows}
        empty="아직 방문 기록이 없어요."
        render={r => (
          <Bar key={r.path} label={r.path} ratio={r.exits / max}
            right={<><b>{r.exits.toLocaleString()}</b><Muted>{r.bounces > 0 ? ` · 직행 ${r.bounces.toLocaleString()}` : ''}</Muted></>} />
        )}
      />
    </>
  )
}

/* ── 방문 여정 ────────────────────────────────────────────── */
function SessionsTab({ days }: { days: number }) {
  const [rows, setRows] = useState<VisitSessionRow[] | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [steps, setSteps] = useState<SessionStep[] | null>(null)

  useEffect(() => {
    let alive = true
    setRows(null); setOpenId(null); setSteps(null)
    getRecentVisitSessions(days, 60).then(r => { if (alive) setRows(r) })
    return () => { alive = false }
  }, [days])

  const open = (id: string) => {
    if (openId === id) { setOpenId(null); setSteps(null); return }
    setOpenId(id); setSteps(null)
    getVisitSessionPath(id).then(setSteps).catch(() => setSteps([]))
  }

  return (
    <>
      <p style={pageHint}>방문자 한 명이 어떤 순서로 돌아봤는지예요. 줄을 누르면 전체 경로가 펼쳐집니다.</p>
      {rows === null ? <Loading /> : rows.length === 0 ? <Empty text="아직 방문 기록이 없어요." /> : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {rows.map(s => {
            const isOpen = openId === s.sessionId
            return (
              <div key={s.sessionId} style={{ borderBottom: '1px solid var(--border)' }}>
                <button onClick={() => open(s.sessionId)} style={sessionRow}>
                  <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <span style={{ fontSize: 13, fontWeight: 800, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.nickname ?? '비회원'}
                      <span style={{ fontWeight: 600, color: 'var(--muted)' }}> · {fmtTime(s.startedAt)}</span>
                    </span>
                    <span style={{ fontSize: 11.5, color: 'var(--muted)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.entryPath} {s.pageCount > 1 && `→ … → ${s.exitPath}`}
                    </span>
                  </span>
                  <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 800, color: 'var(--accent)' }}>{s.pageCount}p</span>
                  <span style={{ flexShrink: 0, color: 'var(--muted)', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s', display: 'flex' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
                  </span>
                </button>

                {isOpen && (
                  <div style={{ padding: '4px 4px 14px 12px' }}>
                    {steps === null ? <Loading /> : steps.length === 0 ? <Empty text="경로를 불러오지 못했어요." /> : (
                      <ol style={{ margin: 0, padding: 0, listStyle: 'none', borderLeft: '2px solid var(--border)' }}>
                        {steps.map((st, i) => (
                          <li key={i} style={{ position: 'relative', padding: '5px 0 5px 14px', fontSize: 12.5 }}>
                            <span style={{ position: 'absolute', left: -5, top: 11, width: 8, height: 8, borderRadius: 9999, background: i === steps.length - 1 ? 'var(--muted)' : 'var(--accent)' }} />
                            <span style={{ fontWeight: 700, wordBreak: 'break-all' }}>{st.path}</span>
                            <span style={{ color: 'var(--muted)', marginLeft: 8 }}>{fmtClock(st.at)}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

/* ── 공통 조각 ────────────────────────────────────────────── */
function Rows<T>({ rows, empty, render }: { rows: T[] | null; empty: string; render: (r: T) => React.ReactNode }) {
  if (rows === null) return <Loading />
  if (rows.length === 0) return <Empty text={empty} />
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>{rows.map(render)}</div>
}

function Bar({ label, sub, ratio, right, muted }: {
  label: string; sub?: string; ratio: number; right: React.ReactNode; muted?: boolean
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ flex: '0 0 44%', minWidth: 0 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: muted ? 'var(--muted)' : 'var(--text)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={label}>{label}</span>
        {sub && <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</span>}
      </span>
      <span style={{ flex: 1, height: 8, borderRadius: 9999, background: 'var(--surface2)', overflow: 'hidden', minWidth: 0 }}>
        <span style={{ display: 'block', width: `${Math.max(ratio * 100, 2)}%`, height: '100%', borderRadius: 9999, background: muted ? 'var(--border)' : 'var(--accent)' }} />
      </span>
      <span style={{ flex: '0 0 128px', textAlign: 'right', fontSize: 12.5, fontWeight: 800, whiteSpace: 'nowrap' }}>{right}</span>
    </div>
  )
}

const Muted = ({ children }: { children: React.ReactNode }) =>
  <span style={{ color: 'var(--muted)', fontWeight: 600 }}>{children}</span>

const Loading = () =>
  <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>불러오는 중...</div>

const Empty = ({ text }: { text: string }) =>
  <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>{text}</div>

const fmtTime = (s: string) => {
  const d = new Date(s)
  return `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
const fmtClock = (s: string) => {
  const d = new Date(s)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}

const pageHint: React.CSSProperties = { fontSize: 11.5, color: 'var(--muted)', margin: '0 0 12px', lineHeight: 1.6 }

const sessionRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
  padding: '11px 2px', border: 'none', background: 'none',
  cursor: 'pointer', fontFamily: 'inherit', color: 'inherit',
}

function tabBtn(active: boolean): React.CSSProperties {
  return { flexShrink: 0, padding: '7px 13px', borderRadius: 8, border: 'none', background: active ? 'var(--accent)' : 'var(--surface2)', color: active ? '#fff' : 'var(--text)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }
}
function chip(active: boolean): React.CSSProperties {
  return { flexShrink: 0, padding: '6px 11px', borderRadius: 9999, border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, background: active ? 'var(--accent)' : 'var(--surface)', color: active ? '#fff' : 'var(--muted)', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }
}
