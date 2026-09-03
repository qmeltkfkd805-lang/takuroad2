'use client'
import { useState } from 'react'
import { WEEKDAYS, WEEKDAY_LABEL } from '@/lib/constants/categories'
import { BusinessHours, DayHours } from '@/types/database'

/* 영업시간 편집기 — 샵 등록 위저드와 사장님 매장 관리가 같은 걸 쓴다.

   원래 ShopFormWizard 안에 JSX와 핸들러로 박혀 있었고, 사장님 관리(HoursManage)에는
   요일 on/off와 시작·종료 시간만 있는 별개 구현이 있었다. 둘이 갈라지지 않게
   여기 한 곳으로 모았다. 동작·표시는 위저드에 있던 것 그대로다.

   상태를 갖지 않는다 — value/onChange만 받는다. 일괄 적용용 값(bulkOpen 등)만
   이 안에서 로컬로 들고 있는데, 저장되는 데이터가 아니라 편집 도구의 상태다.

   ⚠️ hours(jsonb)에는 요일 키(mon~sun) 외에 holiday·yearRound도 함께 들어간다.
      요일 키만 있다고 가정하는 코드를 새로 만들지 말 것. */

const DEFAULT_DAY: DayHours = { open: '10:00', close: '20:00' }

type Day = typeof WEEKDAYS[number]

/* hours(jsonb)에는 요일 키 말고도 이 둘이 같이 들어간다. BusinessHours 타입에는
   없어서 여기서 넓혀 쓴다. (타입 자체를 고치면 다른 화면까지 영향이 가서 이번엔 두었다) */
type HoursMap = BusinessHours & { holiday?: 'closed'; yearRound?: boolean }

export default function ShopHoursEditor({ value, onChange }: {
  value: BusinessHours | null
  onChange: (next: BusinessHours) => void
}) {
  const hours: HoursMap = value ?? {}

  const [bulkOpen, setBulkOpen] = useState('10:00')
  const [bulkClose, setBulkClose] = useState('20:00')
  const [pickDays, setPickDays] = useState<Day[]>([])
  const [breakOn, setBreakOn] = useState(false)
  const [bulkBreakStart, setBulkBreakStart] = useState('15:00')
  const [bulkBreakEnd, setBulkBreakEnd] = useState('16:00')

  const allDaysApplied = WEEKDAYS.every(d => {
    const dh = hours[d]
    return !!dh && dh.open === bulkOpen && dh.close === bulkClose
  })
  const showBreak = breakOn || WEEKDAYS.some(d => !!hours[d]?.breakStart)
  const holidayClosed = hours.holiday === 'closed'
  const yearRound = !!hours.yearRound

  function toggleAllDays() {
    const next: HoursMap = { ...hours }
    WEEKDAYS.forEach(d => { next[d] = allDaysApplied ? null : { open: bulkOpen, close: bulkClose } })
    onChange(next)
  }
  function toggleHoliday() {
    const next: HoursMap = { ...hours }
    if (holidayClosed) delete next.holiday
    else { next.holiday = 'closed'; delete next.yearRound }
    onChange(next)
  }
  function toggleYearRound() {
    const next: HoursMap = { ...hours }
    if (yearRound) delete next.yearRound
    else { next.yearRound = true; delete next.holiday }
    onChange(next)
  }
  function applySelectedDays() {
    if (pickDays.length === 0) return
    const next: HoursMap = { ...hours }
    pickDays.forEach(d => { next[d] = { ...(next[d] ?? DEFAULT_DAY), open: bulkOpen, close: bulkClose } })
    onChange(next)
    setPickDays([])
  }
  function togglePickDay(day: Day) {
    setPickDays(p => p.includes(day) ? p.filter(x => x !== day) : [...p, day])
  }
  // 끄면 모든 요일의 휴게시간을 지운다
  function toggleBreak() {
    const anyBreak = WEEKDAYS.some(d => !!hours[d]?.breakStart)
    if (breakOn || anyBreak) {
      const next: HoursMap = { ...hours }
      WEEKDAYS.forEach(d => { const dh = hours[d]; if (dh) next[d] = { open: dh.open, close: dh.close } })
      onChange(next)
      setBreakOn(false)
    } else {
      setBreakOn(true)
    }
  }
  function applyBreakToOpenDays() {
    const next: HoursMap = { ...hours }
    WEEKDAYS.forEach(d => { const dh = hours[d]; if (dh) next[d] = { ...dh, breakStart: bulkBreakStart, breakEnd: bulkBreakEnd } })
    onChange(next)
  }
  function setDay(day: Day, patch: DayHours | null) {
    const next: HoursMap = { ...hours }
    next[day] = patch
    onChange(next)
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12, padding: 12, background: 'var(--surface2)', borderRadius: 10 }}>
        {/* 시간 + 적용 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--muted)' }}>같은 시간</span>
          <TimeField value={bulkOpen} onChange={setBulkOpen} />
          <span style={{ color: 'var(--muted)' }}>~</span>
          <TimeField value={bulkClose} onChange={setBulkClose} />
          <ToggleBtn on={allDaysApplied} onClick={toggleAllDays} label="모든 요일 적용" />
        </div>

        {/* 요일 선택 칩 (선택 요일 적용용) */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
          <button type="button" onClick={() => setPickDays(['mon', 'tue', 'wed', 'thu', 'fri'])} style={presetBtn}>평일</button>
          <button type="button" onClick={() => setPickDays(['sat', 'sun'])} style={presetBtn}>주말</button>
          <span style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 2px' }} />
          {WEEKDAYS.map(day => {
            const on = pickDays.includes(day)
            return (
              <button key={day} type="button" onClick={() => togglePickDay(day)}
                style={{ width: 30, padding: '5px 0', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 12, border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'var(--accent-l, rgba(232,0,111,.08))' : 'var(--surface)', color: on ? 'var(--accent)' : 'var(--muted)' }}>
                {WEEKDAY_LABEL[day]}
              </button>
            )
          })}
          <button type="button" onClick={applySelectedDays} disabled={pickDays.length === 0}
            style={{ marginLeft: 4, padding: '6px 13px', borderRadius: 8, cursor: pickDays.length ? 'pointer' : 'default', fontFamily: 'inherit', fontWeight: 800, fontSize: 12.5, border: `1.5px solid ${pickDays.length ? 'var(--accent)' : 'var(--border)'}`, background: pickDays.length ? 'var(--accent)' : 'var(--surface)', color: pickDays.length ? '#fff' : 'var(--muted)', opacity: pickDays.length ? 1 : .55 }}>
            선택 요일 적용{pickDays.length ? ` (${pickDays.length})` : ''}
          </button>
        </div>
        <div style={{ fontSize: 11.5, color: pickDays.length ? 'var(--accent)' : 'var(--muted)', fontWeight: pickDays.length ? 700 : 400, marginTop: -4 }}>
          {pickDays.length ? `${pickDays.length}개 요일 선택됨 — “선택 요일 적용”을 누르세요` : '요일을 고른 뒤 “선택 요일 적용”을 누르면 그 요일에만 위 시간이 들어가요.'}
        </div>

        {/* 플래그 + 휴게 토글 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <ToggleBtn on={holidayClosed} onClick={toggleHoliday} label="공휴일 휴무" />
          <ToggleBtn on={yearRound} onClick={toggleYearRound} label="연중무휴" />
          <ToggleBtn on={showBreak} onClick={toggleBreak} label="휴게시간" />
        </div>

        {/* 휴게시간 일괄 (휴게 켰을 때만) */}
        {showBreak && (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--muted)' }}>휴게시간</span>
            <TimeField value={bulkBreakStart} onChange={setBulkBreakStart} />
            <span style={{ color: 'var(--muted)' }}>~</span>
            <TimeField value={bulkBreakEnd} onChange={setBulkBreakEnd} />
            <button type="button" onClick={applyBreakToOpenDays}
              style={{ padding: '7px 13px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800, fontSize: 12.5, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}>
              휴게시간 모든 요일 적용
            </button>
          </div>
        )}
      </div>

      {/* 요일별 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {WEEKDAYS.map(day => {
          const dayHours = hours[day]
          const isOpen = !!dayHours
          const hasBreak = !!(dayHours && (dayHours.breakStart || dayHours.breakEnd))
          return (
            <div key={day} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setDay(day, isOpen ? null : { ...DEFAULT_DAY })}
                style={{ width: 34, flexShrink: 0, padding: '6px 0', borderRadius: 6, border: `1.5px solid ${isOpen ? 'var(--accent)' : 'var(--border)'}`, background: isOpen ? 'var(--accent-l, rgba(232,0,111,.08))' : 'var(--surface)', color: isOpen ? 'var(--accent)' : 'var(--muted)', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                {WEEKDAY_LABEL[day]}
              </button>
              {isOpen && dayHours ? (
                <>
                  <TimeField value={dayHours.open} onChange={v => setDay(day, { ...dayHours, open: v })} />
                  <span style={{ color: 'var(--muted)' }}>~</span>
                  <TimeField value={dayHours.close} onChange={v => setDay(day, { ...dayHours, close: v })} />
                  {showBreak && (hasBreak ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 2 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)' }}>휴게</span>
                      <TimeField value={dayHours.breakStart ?? ''} onChange={v => setDay(day, { ...dayHours, breakStart: v })} />
                      <span style={{ color: 'var(--muted)' }}>~</span>
                      <TimeField value={dayHours.breakEnd ?? ''} onChange={v => setDay(day, { ...dayHours, breakEnd: v })} />
                      <button type="button" title="휴게 삭제" aria-label={`${WEEKDAY_LABEL[day]} 휴게시간 삭제`}
                        onClick={() => setDay(day, { open: dayHours.open, close: dayHours.close })}
                        style={{ width: 24, height: 24, borderRadius: 6, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, lineHeight: 1 }}>×</button>
                    </span>
                  ) : (
                    <button type="button" onClick={() => setDay(day, { ...dayHours, breakStart: bulkBreakStart, breakEnd: bulkBreakEnd })}
                      style={{ padding: '5px 10px', borderRadius: 6, border: '1.5px dashed var(--border)', background: 'var(--surface)', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 12 }}>
                      + 휴게
                    </button>
                  ))}
                </>
              ) : <span style={{ fontSize: 13, color: 'var(--muted)' }}>휴무</span>}
            </div>
          )
        })}
      </div>
    </>
  )
}

/* 위저드에서 세 군데 반복되던 토글 버튼. 켜지면 체크 아이콘이 붙는다. */
function ToggleBtn({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      style={{ padding: '7px 13px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800, fontSize: 12.5, border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'var(--accent-l, rgba(232,0,111,.08))' : 'var(--surface)', color: on ? 'var(--accent)' : 'var(--text)' }}>
      {on ? <><CheckMark /> {label}</> : label}
    </button>
  )
}

function CheckMark() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0, verticalAlign: '-2px' }}>
      <path d="m5 12 5 5L20 6" />
    </svg>
  )
}

/* 24시간제 시간 입력 (0~24시). 오전/오후 없이 숫자로 직접 입력.
   종료가 시작보다 이르면(예: 09:00~01:00) 자동으로 다음날로 계산된다(date.ts). */
export function TimeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [hhStr, mmStr] = (value || '00:00').split(':')
  const hh = Number(hhStr) || 0
  const mm = Number(mmStr) || 0

  // 타이핑 중 표시용 로컬 상태. 밖에서 값이 바뀌면(일괄적용 등) 동기화하되,
  // 입력 중(focused)엔 건드리지 않아 커서/자릿수가 튀지 않게 한다.
  const [focused, setFocused] = useState(false)
  const [hText, setHText] = useState(String(hh).padStart(2, '0'))
  const [mText, setMText] = useState(String(mm).padStart(2, '0'))

  /* effect가 아니라 "렌더 중 파생 상태 조정"으로 맞춘다. effect에서 setState를 부르면
     한 프레임 늦게 반영되고 렌더가 한 번 더 돈다(react-hooks/set-state-in-effect).
     입력 중에 밖에서 값이 바뀌면 여기서는 넘어가고, 포커스가 풀릴 때 onBlur가 맞춘다. */
  const [prevValue, setPrevValue] = useState(value)
  if (!focused && value !== prevValue) {
    setPrevValue(value)
    setHText(String(hh).padStart(2, '0'))
    setMText(String(mm).padStart(2, '0'))
  }

  const commit = (hv: number, mv: number) => {
    const ch = Math.min(24, Math.max(0, hv || 0))
    const cm = ch === 24 ? 0 : Math.min(59, Math.max(0, mv || 0))   // 24시는 분 0 고정
    onChange(`${String(ch).padStart(2, '0')}:${String(cm).padStart(2, '0')}`)
  }
  const onHour = (raw: string) => { const d = raw.replace(/\D/g, '').slice(0, 2); setHText(d); if (d !== '') commit(Number(d), mm) }
  const onMin = (raw: string) => { const d = raw.replace(/\D/g, '').slice(0, 2); setMText(d); if (d !== '') commit(hh, Number(d)) }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <input inputMode="numeric" value={hText} aria-label="시" maxLength={2}
        onFocus={e => { setFocused(true); e.target.select() }}
        onBlur={() => { setFocused(false); setHText(String(hh).padStart(2, '0')) }}
        onChange={e => onHour(e.target.value)} style={numInp} />
      <span style={{ color: 'var(--muted)' }}>:</span>
      <input inputMode="numeric" value={mText} aria-label="분" maxLength={2}
        onFocus={e => { setFocused(true); e.target.select() }}
        onBlur={() => { setFocused(false); setMText(String(mm).padStart(2, '0')) }}
        onChange={e => onMin(e.target.value)} style={numInp} />
    </span>
  )
}

const numInp: React.CSSProperties = {
  width: 44, padding: '6px 4px', borderRadius: 10, border: '1px solid var(--border)',
  fontFamily: 'inherit', fontSize: 13, textAlign: 'center',
  background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box', outline: 'none',
}

const presetBtn: React.CSSProperties = {
  padding: '5px 10px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
  fontWeight: 700, fontSize: 12, border: '1.5px solid var(--border)',
  background: 'var(--surface)', color: 'var(--muted)',
}

/* 영업시간 입력 안내 — 위저드와 사장님 관리에서 같은 문구를 쓴다 */
export const HOURS_HINT = (
  <>24시 표기로 입력해 주세요. (예: 오후 6시 → 18, 자정 마감 → 24)<br />
  종료가 시작보다 빠르면 다음날로 계산돼요.<br />
  비우면 휴무로 표시돼요.</>
)
