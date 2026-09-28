'use client'
import { useState } from 'react'
import { WEEKDAYS, WEEKDAY_LABEL } from '@/lib/constants/categories'
import { BusinessHours, DayHours } from '@/types/database'

/* 영업시간 편집기 — 샵 등록 위저드와 사장님 매장 관리가 같은 걸 쓴다.

   입력 방식: "시간을 먼저 정하고 → 그 시간에 여는 요일을 누른다."
   요일마다 시간이 다르면 "다른 영업시간 추가"로 시간 묶음을 하나 더 만든다.
     예) [10:00~20:00  월 화 수 목 금]  [11:00~19:00  토 일]
   어느 묶음에도 없는 요일 = 휴무.

   (예전엔 "같은 시간+모든 요일 적용" / "요일 칩+선택 요일 적용" / 요일별 7줄 목록이
    한 화면에 섞여 있어 어디부터 눌러야 할지 헷갈린다는 피드백이 있었다.)

   저장 형식은 그대로다 — hours(jsonb)의 요일 키(mon~sun)에 {open, close, breakStart?, breakEnd?}.
   묶음은 편집용 화면 상태일 뿐, 저장할 때 요일별로 풀어서 넣는다.
   불러올 때는 같은 시간(휴게 포함)을 가진 요일끼리 다시 묶어 보여준다.

   ⚠️ hours(jsonb)에는 요일 키 외에 holiday·yearRound도 함께 들어간다.
      요일 키만 있다고 가정하는 코드를 새로 만들지 말 것. */

type Day = typeof WEEKDAYS[number]
type HoursMap = BusinessHours & { holiday?: 'closed'; yearRound?: boolean }

interface Group {
  id: number
  days: Day[]
  open: string
  close: string
  breakStart: string | null
  breakEnd: string | null
}

const DEFAULT_OPEN = '10:00'
const DEFAULT_CLOSE = '20:00'
const DEFAULT_BREAK_START = '15:00'
const DEFAULT_BREAK_END = '16:00'

let groupSeq = 1
const newGroup = (patch: Partial<Group> = {}): Group => ({
  id: groupSeq++, days: [], open: DEFAULT_OPEN, close: DEFAULT_CLOSE, breakStart: null, breakEnd: null, ...patch,
})

/* 저장된 hours → 같은 시간끼리 묶음. 여는 요일이 없으면 빈 묶음 하나(요일 미선택). */
function toGroups(value: BusinessHours | null): Group[] {
  const hours: HoursMap = value ?? {}
  const byKey = new Map<string, Group>()
  for (const d of WEEKDAYS) {
    const dh = hours[d]
    if (!dh) continue
    const key = [dh.open, dh.close, dh.breakStart ?? '', dh.breakEnd ?? ''].join('|')
    const g = byKey.get(key)
    if (g) g.days.push(d)
    else byKey.set(key, newGroup({ days: [d], open: dh.open, close: dh.close, breakStart: dh.breakStart ?? null, breakEnd: dh.breakEnd ?? null }))
  }
  const list = [...byKey.values()]
  return list.length ? list : [newGroup()]
}

/* 묶음 → 저장용 hours. holiday·yearRound 는 그대로 유지. */
function toHours(groups: Group[], extras: Pick<HoursMap, 'holiday' | 'yearRound'>): HoursMap {
  const next: HoursMap = {}
  for (const d of WEEKDAYS) {
    const g = groups.find(x => x.days.includes(d))
    if (!g) { next[d] = null; continue }
    const dh: DayHours = { open: g.open, close: g.close }
    if (g.breakStart && g.breakEnd) { dh.breakStart = g.breakStart; dh.breakEnd = g.breakEnd }
    next[d] = dh
  }
  if (extras.holiday === 'closed') next.holiday = 'closed'
  if (extras.yearRound) next.yearRound = true
  return next
}

/* 요일 목록 → "월~금" / "토·일" 처럼 짧게 */
function daysLabel(days: Day[]): string {
  const idx = days.map(d => WEEKDAYS.indexOf(d)).sort((a, b) => a - b)
  const parts: string[] = []
  for (let i = 0; i < idx.length; i++) {
    let j = i
    while (j + 1 < idx.length && idx[j + 1] === idx[j] + 1) j++
    if (j - i >= 2) parts.push(`${WEEKDAY_LABEL[WEEKDAYS[idx[i]]]}~${WEEKDAY_LABEL[WEEKDAYS[idx[j]]]}`)
    else for (let k = i; k <= j; k++) parts.push(WEEKDAY_LABEL[WEEKDAYS[idx[k]]])
    i = j
  }
  return parts.join('·')
}

const PRESETS: { label: string; days: Day[] }[] = [
  { label: '매일', days: [...WEEKDAYS] },
  { label: '평일', days: ['mon', 'tue', 'wed', 'thu', 'fri'] },
  { label: '주말', days: ['sat', 'sun'] },
]

export default function ShopHoursEditor({ value, onChange }: {
  value: BusinessHours | null
  onChange: (next: BusinessHours) => void
}) {
  const hours: HoursMap = value ?? {}
  const [groups, setGroups] = useState<Group[]>(() => toGroups(value))

  /* 밖에서 값이 새로 들어오면(수정 화면에서 매장 정보를 늦게 불러온 경우 등) 다시 묶는다.
     내가 방금 보낸 값이 돌아온 거면 묶음을 그대로 둔다(빈 묶음·순서 유지).
     effect 대신 렌더 중 파생 상태 조정 — react-hooks/set-state-in-effect 회피. */
  const [seen, setSeen] = useState<BusinessHours | null>(value)
  const [emitted, setEmitted] = useState<BusinessHours | null>(null)
  if (value !== seen) {
    setSeen(value)
    if (value !== emitted) setGroups(toGroups(value))
  }

  const extras = { holiday: hours.holiday, yearRound: hours.yearRound }
  const holidayClosed = hours.holiday === 'closed'
  const yearRound = !!hours.yearRound

  function emit(nextGroups: Group[], nextExtras = extras) {
    setGroups(nextGroups)
    const h = toHours(nextGroups, nextExtras)
    setEmitted(h)
    onChange(h)
  }
  function patchGroup(id: number, patch: Partial<Group>) {
    emit(groups.map(g => g.id === id ? { ...g, ...patch } : g))
  }
  /* 요일을 이 묶음에 넣고 빼기. 다른 묶음에 있던 요일이면 이쪽으로 옮긴다. */
  function toggleDay(id: number, day: Day) {
    const mine = groups.find(g => g.id === id)
    if (!mine) return
    if (mine.days.includes(day)) {
      emit(groups.map(g => g.id === id ? { ...g, days: g.days.filter(d => d !== day) } : g))
    } else {
      emit(groups.map(g => g.id === id ? { ...g, days: [...g.days, day] } : { ...g, days: g.days.filter(d => d !== day) }))
    }
  }
  function setPreset(id: number, days: Day[]) {
    emit(groups.map(g => g.id === id ? { ...g, days: [...days] } : { ...g, days: g.days.filter(d => !days.includes(d)) }))
  }
  function addGroup() {
    emit([...groups, newGroup()])
  }
  function removeGroup(id: number) {
    const rest = groups.filter(g => g.id !== id)
    emit(rest.length ? rest : [newGroup()])
  }
  function toggleHoliday() {
    emit(groups, holidayClosed ? { ...extras, holiday: undefined } : { holiday: 'closed', yearRound: undefined })
  }
  function toggleYearRound() {
    emit(groups, yearRound ? { ...extras, yearRound: undefined } : { holiday: undefined, yearRound: true })
  }

  const usedDays = new Set(groups.flatMap(g => g.days))
  const closedDays = WEEKDAYS.filter(d => !usedDays.has(d))
  const anyOpen = usedDays.size > 0
  const summary = groups
    .filter(g => g.days.length)
    .sort((a, b) => Math.min(...a.days.map(d => WEEKDAYS.indexOf(d))) - Math.min(...b.days.map(d => WEEKDAYS.indexOf(d))))
    .map(g => `${daysLabel(g.days)} ${g.open}~${g.close}${g.breakStart && g.breakEnd ? ` (휴게 ${g.breakStart}~${g.breakEnd})` : ''}`)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {groups.map((g, gi) => (
        <div key={g.id} style={{ padding: '16px 16px 14px', borderRadius: 14, border: '1.5px solid var(--border)', background: 'var(--surface)' }}>
          {/* 1) 시간 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={stepLabel}>{groups.length > 1 ? `영업시간 ${gi + 1}` : '영업시간'}</span>
            <TimeField value={g.open} onChange={v => patchGroup(g.id, { open: v })} />
            <span style={{ color: 'var(--muted)', fontSize: 15 }}>~</span>
            <TimeField value={g.close} onChange={v => patchGroup(g.id, { close: v })} />
            {groups.length > 1 && (
              <button type="button" onClick={() => removeGroup(g.id)} aria-label={`영업시간 ${gi + 1} 삭제`}
                style={{ marginLeft: 'auto', padding: '6px 11px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700 }}>
                삭제
              </button>
            )}
          </div>

          {/* 2) 이 시간에 여는 요일 */}
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>이 시간에 여는 요일을 눌러주세요</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
              {WEEKDAYS.map(day => {
                const on = g.days.includes(day)
                const elsewhere = !on && usedDays.has(day)
                return (
                  <button key={day} type="button" onClick={() => toggleDay(g.id, day)} aria-pressed={on}
                    title={elsewhere ? '다른 영업시간에 들어가 있어요. 누르면 이쪽으로 옮겨요.' : undefined}
                    style={{
                      width: 42, height: 40, borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800, fontSize: 14.5,
                      // 선택 = 주차 선택 칩과 같은 톤(연한 분홍 바탕 + 분홍 테두리·글자)
                      border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                      background: on ? 'var(--accent-l, rgba(232,0,111,.08))' : 'var(--surface)',
                      color: on ? 'var(--accent)' : elsewhere ? 'var(--border)' : 'var(--text)',
                      textDecoration: elsewhere ? 'line-through' : 'none',
                    }}>
                    {WEEKDAY_LABEL[day]}
                  </button>
                )
              })}
              <span style={{ width: 1, height: 22, background: 'var(--border)', margin: '0 4px' }} />
              {PRESETS.map(p => (
                <button key={p.label} type="button" onClick={() => setPreset(g.id, p.days)} style={presetBtn}>{p.label}</button>
              ))}
            </div>
          </div>

          {/* 3) 휴게시간(선택) */}
          <div style={{ marginTop: 12 }}>
            {g.breakStart && g.breakEnd ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ ...stepLabel, fontSize: 13.5 }}>휴게시간</span>
                <TimeField value={g.breakStart} onChange={v => patchGroup(g.id, { breakStart: v })} />
                <span style={{ color: 'var(--muted)', fontSize: 15 }}>~</span>
                <TimeField value={g.breakEnd} onChange={v => patchGroup(g.id, { breakEnd: v })} />
                <button type="button" onClick={() => patchGroup(g.id, { breakStart: null, breakEnd: null })}
                  style={{ padding: '6px 11px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700 }}>
                  휴게 없음
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => patchGroup(g.id, { breakStart: DEFAULT_BREAK_START, breakEnd: DEFAULT_BREAK_END })}
                style={{ padding: '7px 12px', borderRadius: 8, border: '1.5px dashed var(--border)', background: 'var(--surface)', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 13 }}>
                + 휴게시간 (브레이크 타임)
              </button>
            )}
          </div>
        </div>
      ))}

      {/* 다른 시간 추가 */}
      {closedDays.length > 0 && anyOpen && (
        <button type="button" onClick={addGroup}
          style={{ alignSelf: 'flex-start', padding: '10px 16px', borderRadius: 10, border: '1.5px dashed var(--accent, #ff5692)', background: 'var(--surface)', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800, fontSize: 14 }}>
          + 요일마다 시간이 달라요 (다른 영업시간 추가)
        </button>
      )}

      {/* 공휴일·연중무휴 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <ToggleBtn on={holidayClosed} onClick={toggleHoliday} label="공휴일 휴무" />
        <ToggleBtn on={yearRound} onClick={toggleYearRound} label="연중무휴" />
      </div>

      {/* 요약 — 실제로 저장될 내용 */}
      <div style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--surface2)', fontSize: 14, lineHeight: 1.7, color: 'var(--text)' }}>
        {anyOpen ? (
          <>
            {summary.map((line, i) => <div key={i}>{line}</div>)}
            <div style={{ color: 'var(--muted)' }}>
              {closedDays.length ? `쉬는 요일: ${daysLabel(closedDays)}` : '쉬는 요일 없음'}
              {holidayClosed ? ' · 공휴일 휴무' : ''}{yearRound ? ' · 연중무휴' : ''}
            </div>
          </>
        ) : (
          <span style={{ color: 'var(--muted)' }}>아직 여는 요일을 고르지 않았어요. 요일을 누르면 여기에 정리돼요.</span>
        )}
      </div>
    </div>
  )
}

function ToggleBtn({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      style={{ padding: '8px 14px', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800, fontSize: 13.5, border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'var(--accent-l, rgba(232,0,111,.08))' : 'var(--surface)', color: on ? 'var(--accent)' : 'var(--text)' }}>
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

const stepLabel: React.CSSProperties = { fontSize: 14.5, fontWeight: 800, color: 'var(--text)', minWidth: 72 }

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
  width: 50, padding: '8px 4px', borderRadius: 10, border: '1px solid var(--border)',
  fontFamily: 'inherit', fontSize: 15, textAlign: 'center',
  background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box', outline: 'none',
}

const presetBtn: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
  fontWeight: 700, fontSize: 13, border: '1.5px solid var(--border)',
  background: 'var(--surface)', color: 'var(--muted)',
}

/* 영업시간 입력 안내 — 위저드와 사장님 관리에서 같은 문구를 쓴다 */
export const HOURS_HINT = (
  <>시간을 먼저 정하고, 그 시간에 여는 요일을 눌러주세요. 요일마다 시간이 다르면 "다른 영업시간 추가"를 누르면 돼요.<br />
  24시 표기로 입력해 주세요. (예: 오후 6시 → 18, 자정 마감 → 24) 종료가 시작보다 빠르면 다음날로 계산돼요.</>
)
