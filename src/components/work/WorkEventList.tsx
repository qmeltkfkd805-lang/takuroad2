'use client'

import { useState } from 'react'
import Link from 'next/link'
import { WorkEvent, WORK_EVENT_ICON, WORK_EVENT_LABEL } from '@/services/eventService'

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return '방금'
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 전`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}일 전`
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return ''
  return new Date(s).toLocaleDateString('ko-KR')
}
function fmtRange(start: string | null | undefined, end: string | null | undefined): string | null {
  if (!start && !end) return null
  if (start && end) return `${fmtDate(start)} ~ ${fmtDate(end)}`
  return fmtDate(start ?? end)
}

export default function WorkEventList({ events }: { events: WorkEvent[] }) {
  const [selected, setSelected] = useState<WorkEvent | null>(null)
  if (events.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {events.map(ev => {
        const icon = WORK_EVENT_ICON[ev.type] ?? '✨'
        return (
          <div
            key={ev.id}
            onClick={() => setSelected(ev)}
            style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '12px 14px', borderRadius: 'var(--r-sm)', cursor: 'pointer',
              border: '1px solid var(--border)', background: 'var(--surface)',
            }}
          >
            <span style={{ fontSize: '20px', flexShrink: 0 }}>{icon}</span>
            <span style={{ flex: 1, fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>
              {ev.title ?? (WORK_EVENT_LABEL[ev.type] ?? '새로운 소식')}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--muted)', flexShrink: 0 }}>
              {timeAgo(ev.createdAt)}
            </span>
          </div>
        )
      })}

      {/* 상세 모달 */}
      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 999,
            background: 'rgba(0,0,0,.6)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--surface)', borderRadius: '20px 20px 0 0',
              width: '100%', maxWidth: '680px', maxHeight: '85vh', overflowY: 'auto',
              padding: '20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>{WORK_EVENT_ICON[selected.type] ?? '✨'}</span>
                <span style={{ fontWeight: 900, fontSize: '16px' }}>
                  {selected.title ?? (WORK_EVENT_LABEL[selected.type] ?? '새로운 소식')}
                </span>
              </div>
              <button
                onClick={() => setSelected(null)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--muted)' }}
              >✕</button>
            </div>

            {/* 종류 배지 */}
            <span style={{
              display: 'inline-block', fontSize: '12px', fontWeight: 700,
              color: 'var(--accent)', background: 'var(--accent-l)',
              padding: '4px 10px', borderRadius: '999px', marginBottom: '14px',
            }}>
              {WORK_EVENT_LABEL[selected.type] ?? '소식'}
            </span>

            {/* 기간 */}
            {fmtRange(selected.startDate, selected.endDate) && (
              <p style={{ fontSize: '14px', color: 'var(--text)', marginBottom: '8px' }}>
                📅 {fmtRange(selected.startDate, selected.endDate)}
              </p>
            )}

            {/* 장소(샵) — 그 샵 상세로 이동 */}
            {selected.shopSlug ? (
              <Link
                href={`/shop/${selected.shopSlug}`}
                style={{
                  display: 'inline-block', fontSize: '14px', fontWeight: 700,
                  color: 'var(--accent)', textDecoration: 'none', marginBottom: '8px',
                }}
              >
                📍 {selected.shopName ?? '샵 보기'} ↗
              </Link>
            ) : selected.shopName ? (
              <p style={{ fontSize: '14px', color: 'var(--text)', marginBottom: '8px' }}>
                📍 {selected.shopName}
              </p>
            ) : null}

            <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '6px' }}>
              {timeAgo(selected.createdAt)} 등록
            </p>
          </div>
        </div>
      )}
    </div>
  )
}