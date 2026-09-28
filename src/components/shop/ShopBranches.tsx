'use client'

import { useState } from 'react'
import type { ShopBranch } from '@/types/shop'

/* 층별 매장 구성 — 같은 건물 여러 층의 본점·1호점·2호점을 한눈에.
   - ShopBranchEditor : 샵 등록·수정 위저드용 입력
   - ShopBranchList   : 샵 상세(PC·모바일) 표시용
   저장은 shops.branches(jsonb). 정리 규칙은 shopService.normalizeBranches. */

/* 자주 쓰는 취급 품목 — 누르면 바로 칩으로 들어간다(직접 입력도 가능) */
const ITEM_PRESETS = ['피규어', '가챠', '굿즈', '카드', '카드가챠', '제일복권', '프라모델', '공식 MD', '중고']

const emptyBranch = (): ShopBranch => ({ floor: '', name: '', room: '', items: [] })

/* ── 입력 ───────────────────────────────────────────────── */
export function ShopBranchEditor({ value, onChange }: { value: ShopBranch[]; onChange: (next: ShopBranch[]) => void }) {
  const rows = value ?? []
  const patch = (i: number, p: Partial<ShopBranch>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...p } : r)))
  const remove = (i: number) => onChange(rows.filter((_, j) => j !== i))
  const move = (i: number, d: number) => {
    const j = i + d
    if (j < 0 || j >= rows.length) return
    const next = [...rows]; [next[i], next[j]] = [next[j], next[i]]; onChange(next)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {rows.map((b, i) => (
        <div key={i} style={{ padding: '14px 14px 12px', borderRadius: 14, border: '1.5px solid var(--border)', background: 'var(--surface)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 110px auto', gap: 8, alignItems: 'center' }}>
            <input value={b.floor} onChange={e => patch(i, { floor: e.target.value })} placeholder="2층" maxLength={20} style={inp} aria-label="층" />
            <input value={b.name} onChange={e => patch(i, { name: e.target.value })} placeholder="본점 / 1호점" maxLength={40} style={inp} aria-label="매장 이름" />
            <input value={b.room ?? ''} onChange={e => patch(i, { room: e.target.value })} placeholder="136호 (선택)" maxLength={30} style={inp} aria-label="호수" />
            <span style={{ display: 'inline-flex', gap: 4 }}>
              <IconBtn label="위로" disabled={i === 0} onClick={() => move(i, -1)}>↑</IconBtn>
              <IconBtn label="아래로" disabled={i === rows.length - 1} onClick={() => move(i, 1)}>↓</IconBtn>
              <IconBtn label="삭제" onClick={() => remove(i)}>×</IconBtn>
            </span>
          </div>
          <ItemsInput items={b.items} onChange={items => patch(i, { items })} />
        </div>
      ))}

      {rows.length < 20 && (
        <button type="button" onClick={() => onChange([...rows, emptyBranch()])}
          style={{ alignSelf: 'flex-start', padding: '10px 16px', borderRadius: 10, border: '1.5px dashed var(--accent, #ff5692)', background: 'var(--surface)', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800, fontSize: 14 }}>
          + 매장 추가
        </button>
      )}
    </div>
  )
}

function ItemsInput({ items, onChange }: { items: string[]; onChange: (next: string[]) => void }) {
  const [text, setText] = useState('')
  const add = (raw: string) => {
    const parts = raw.split(/[,，·]/).map(s => s.trim()).filter(Boolean)
    if (!parts.length) return
    onChange([...new Set([...items, ...parts])].slice(0, 12))
    setText('')
  }
  const toggle = (it: string) => onChange(items.includes(it) ? items.filter(x => x !== it) : [...items, it].slice(0, 12))

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {items.map(it => (
          <span key={it} style={{ ...chip, ...chipOn, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {it}
            <button type="button" onClick={() => onChange(items.filter(x => x !== it))} aria-label={`${it} 빼기`}
              style={{ border: 'none', background: 'none', color: 'inherit', cursor: 'pointer', padding: 0, fontSize: 15, lineHeight: 1 }}>×</button>
          </span>
        ))}
        <input value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(text) } }}
          onBlur={() => add(text)}
          placeholder={items.length ? '품목 추가' : '취급 품목 입력 후 Enter (예: 피규어)'}
          style={{ ...inp, flex: '1 1 180px', minWidth: 140, height: 34 }} aria-label="취급 품목" />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
        {ITEM_PRESETS.filter(p => !items.includes(p)).map(p => (
          <button key={p} type="button" onClick={() => toggle(p)} style={{ ...chip, cursor: 'pointer' }}>+ {p}</button>
        ))}
      </div>
    </div>
  )
}

/* ── 표시 ───────────────────────────────────────────────── */
export function ShopBranchList({ branches, compact }: { branches: ShopBranch[] | undefined; compact?: boolean }) {
  const rows = (branches ?? []).filter(b => b.floor || b.name || b.items.length)
  if (!rows.length) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
      {rows.map((b, i) => (
        <div key={i} style={{
          display: 'grid', gridTemplateColumns: compact ? '56px 1fr' : '72px minmax(120px, 200px) 1fr',
          gap: compact ? 10 : 14, alignItems: 'center', padding: compact ? '12px 14px' : '14px 18px',
          borderTop: i ? '1px solid var(--border)' : 'none', background: 'var(--surface)',
        }}>
          <span style={{ fontSize: compact ? 14 : 15, fontWeight: 900, color: 'var(--accent)' }}>{b.floor || '-'}</span>
          {compact ? (
            <span style={{ minWidth: 0 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{b.name || '매장'}</span>
              {b.room && <span style={{ fontSize: 12.5, color: 'var(--muted)', marginLeft: 6 }}>{b.room}</span>}
              {b.items.length > 0 && <ItemChips items={b.items} style={{ marginTop: 6 }} />}
            </span>
          ) : (
            <>
              <span style={{ minWidth: 0 }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{b.name || '매장'}</span>
                {b.room && <span style={{ fontSize: 13, color: 'var(--muted)', marginLeft: 6 }}>{b.room}</span>}
              </span>
              {b.items.length > 0 ? <ItemChips items={b.items} /> : <span />}
            </>
          )}
        </div>
      ))}
    </div>
  )
}

function ItemChips({ items, style }: { items: string[]; style?: React.CSSProperties }) {
  return (
    <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6, ...style }}>
      {items.map(it => <span key={it} style={chip}>{it}</span>)}
    </span>
  )
}

function IconBtn({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick}
      style={{ width: 32, height: 34, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--muted)', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1, fontFamily: 'inherit', fontSize: 15, fontWeight: 800 }}>
      {children}
    </button>
  )
}

const inp: React.CSSProperties = {
  width: '100%', height: 38, padding: '0 10px', borderRadius: 9, border: '1px solid var(--border)',
  background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', fontSize: 14, boxSizing: 'border-box', outline: 'none',
}
const chip: React.CSSProperties = {
  padding: '4px 10px', borderRadius: 9999, border: '1px solid var(--border)', background: 'var(--surface2)',
  color: 'var(--text)', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', whiteSpace: 'nowrap',
}
const chipOn: React.CSSProperties = {
  border: '1px solid var(--accent)', background: 'var(--accent-l, rgba(232,0,111,.08))', color: 'var(--accent)',
}
