'use client'
import { useState } from 'react'
import { BusinessHours } from '@/types/database'
import { WEEKDAYS, WEEKDAY_LABEL } from '@/lib/constants/categories'
import { isHolidayClosed } from '@/lib/event/eventHours'
import AppIcon from '@/components/tds/AppIcon'

/**
 * 이벤트 운영시간 입력 — 샵 등록 위저드와 같은 조작 방식.
 * 위저드(등록)와 상세 수정 폼 양쪽에서 쓰기 때문에 컴포넌트로 뺐다.
 * 연중무휴 토글은 없다 — 이벤트는 기간이 정해져 있어서 의미가 없다.
 */
export default function EventHoursEditor({
  value, onChange,
}: {
  value: BusinessHours | null
  onChange: (h: BusinessHours | null) => void
}) {
  const [bulkOpen, setBulkOpen] = useState('10:00')
  const [bulkClose, setBulkClose] = useState('22:00')

  const h: any = value ?? {}
  const holiday = isHolidayClosed(value)
  const allApplied = WEEKDAYS.every(d => h[d]?.open === bulkOpen && h[d]?.close === bulkClose)

  const patch = (next: any) => onChange(next)

  const toggleAllDays = () => {
    const next: any = { ...h }
    if (allApplied) {
      for (const d of WEEKDAYS) next[d] = null
    } else {
      for (const d of WEEKDAYS) next[d] = { open: bulkOpen, close: bulkClose }
    }
    patch(next)
  }

  const toggleHoliday = () => patch({ ...h, holiday: holiday ? undefined : 'closed' })

  const toggleDay = (d: string) => {
    const next: any = { ...h }
    next[d] = h[d] ? null : { open: bulkOpen, close: bulkClose }
    patch(next)
  }

  const setTime = (d: string, field: 'open' | 'close', v: string) => {
    patch({ ...h, [d]: { ...h[d], [field]: v } })
  }

  return (
    <div>
      <div style={bar}>
        <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--muted)' }}>매일 같은 시간</span>
        <input type="time" value={bulkOpen} onChange={e => setBulkOpen(e.target.value)} style={timeInp} />
        <span style={{ color: 'var(--muted)' }}>~</span>
        <input type="time" value={bulkClose} onChange={e => setBulkClose(e.target.value)} style={timeInp} />
        <button onClick={toggleAllDays} style={toggle(allApplied)}>
          {allApplied && <AppIcon name="check" size={12} style={{ marginRight: 4 }} />}모든 요일 적용
        </button>
        <button onClick={toggleHoliday} style={toggle(holiday)}>
          {holiday && <AppIcon name="check" size={12} style={{ marginRight: 4 }} />}공휴일 휴무
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {WEEKDAYS.map(d => {
          const day = h[d]
          const open = !!day
          return (
            <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={() => toggleDay(d)} style={dayBtn(open)}>{WEEKDAY_LABEL[d]}</button>
              {open ? (
                <>
                  <input type="time" value={day.open} onChange={e => setTime(d, 'open', e.target.value)} style={timeInp} />
                  <span style={{ color: 'var(--muted)' }}>~</span>
                  <input type="time" value={day.close} onChange={e => setTime(d, 'close', e.target.value)} style={timeInp} />
                </>
              ) : (
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>휴무</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const bar: React.CSSProperties = {
  display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8,
  marginBottom: 12, padding: '10px 12px', background: 'var(--surface2)', borderRadius: 10,
}
const timeInp: React.CSSProperties = {
  border: '1px solid var(--border)', borderRadius: 8, padding: '6px 8px',
  fontSize: 13, fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--text)',
}
function toggle(on: boolean): React.CSSProperties {
  return {
    padding: '7px 13px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
    fontWeight: 800, fontSize: 12.5,
    border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
    background: on ? 'var(--accent-l)' : 'var(--surface)',
    color: on ? 'var(--accent)' : 'var(--text)',
  }
}
function dayBtn(on: boolean): React.CSSProperties {
  return {
    width: 34, flexShrink: 0, padding: '6px 0', borderRadius: 6,
    border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
    background: on ? 'var(--accent-l)' : 'var(--surface)',
    color: on ? 'var(--accent)' : 'var(--muted)',
    fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
  }
}