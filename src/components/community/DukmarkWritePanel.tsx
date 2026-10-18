'use client'

import { useState } from 'react'
import controls from '@/components/settings/settingsControls.module.css'
import { cleanSiteUrl } from '@/lib/utils/dukmark'
import { DUKMARK_USES, DUKMARK_MAX_USES, DUKMARK_MAX_SITES, DukmarkUse } from '@/types/community-post'

/* 글쓰기 › 덕마크에 올리기 (덕질 노하우 글만) — 에디터·툴바는 노하우 글쓰기 그대로, 이 패널만 아래에 붙는다.
   켜면: 사이트(본문 링크로 자동, 빼고 더하기) · 분류(작품 = 글의 작품 태그 그대로, 용도) · 대표 이미지 · 추가 설정
   모바일: 세로로 쌓기 / PC: 왼쪽 라벨 칸 + 오른쪽 내용 (시안 2026-10-18) */

interface Props {
  desktop: boolean
  on: boolean
  onToggle: (on: boolean) => void
  siteUrls: string[]
  onRemoveSite: (url: string) => void
  onAddSite: (url: string) => void
  works: { id: string; name: string }[]
  onRemoveWork: (id: string) => void
  onAddWork: () => void
  uses: DukmarkUse[]
  onUses: (update: (prev: DukmarkUse[]) => DukmarkUse[]) => void
  coverUrl: string | null
  bodyImages: string[]
  onCover: (url: string | null) => void
  byMaker: boolean
  onByMaker: (v: boolean) => void
}

const PC_USES_SHOWN = 4   // PC: 용도 칩은 이만큼 보이고 나머지는 [더보기]

export default function DukmarkWritePanel(p: Props) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const [addErr, setAddErr] = useState('')
  const [coverOpen, setCoverOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)       // 추가 설정
  const [usesAll, setUsesAll] = useState(false)         // PC: 용도 더보기

  const addSite = () => {
    if (!draft.trim()) { setAdding(false); setAddErr(''); return }
    const u = cleanSiteUrl(/^https?:\/\//i.test(draft.trim()) ? draft : 'https://' + draft.trim())
    if (!u) { setAddErr('주소를 확인해 주세요.'); return }
    p.onAddSite(u); setDraft(''); setAddErr(''); setAdding(false)
  }
  const toggleUse = (u: DukmarkUse) => p.onUses(prev =>
    prev.includes(u) ? prev.filter(x => x !== u) : prev.length < DUKMARK_MAX_USES ? [...prev, u] : prev)
  const shownCover = p.coverUrl ?? p.bodyImages[0] ?? null
  const canAddSite = p.siteUrls.length < DUKMARK_MAX_SITES

  // ── 조각들 ──
  const siteList = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 0 }}>
      {p.siteUrls.map(u => (
        <div key={u} style={siteRow}>
          <LinkIcon />
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u}</span>
          <button type="button" aria-label="이 사이트 빼기" onClick={() => p.onRemoveSite(u)} style={xBtn}>×</button>
        </div>
      ))}
      {adding && (
        <div style={{ ...siteRow, borderColor: 'var(--accent)' }}>
          <LinkIcon />
          <input autoFocus value={draft} onChange={e => { setDraft(e.target.value); setAddErr('') }}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSite() } if (e.key === 'Escape') { setAdding(false); setDraft(''); setAddErr('') } }}
            onBlur={addSite} placeholder="https://" inputMode="url" aria-label="사이트 주소"
            style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'none', fontSize: 14, color: 'var(--text)', fontFamily: 'inherit', padding: 0 }} />
        </div>
      )}
      {p.siteUrls.length === 0 && !adding && <div style={{ fontSize: 13, color: 'var(--muted)', padding: '4px 2px' }}>본문에 링크를 넣으면 자동으로 채워져요.</div>}
      {addErr && <div style={{ fontSize: 12.5, color: '#c0392b' }}>{addErr}</div>}
    </div>
  )
  const addSiteBtn = (full: boolean) => canAddSite && !adding && (
    <button type="button" onClick={() => setAdding(true)}
      style={full
        ? { width: '100%', padding: '11px', borderRadius: 10, border: '1px dashed var(--border)', background: 'var(--surface)', color: 'var(--accent)', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }
        : { flexShrink: 0, alignSelf: 'flex-start', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
      + 사이트 추가
    </button>
  )
  const workChips = (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      {p.works.length === 0 && <span style={{ ...pillOff, cursor: 'default', color: 'var(--muted)' }}>전체 공통</span>}
      {p.works.map(w => (
        <button key={w.id} type="button" aria-label={`${w.name} 빼기`} onClick={() => p.onRemoveWork(w.id)} style={pillOn}><Check />{w.name}</button>
      ))}
      <button type="button" onClick={p.onAddWork} style={{ ...pillOff, borderStyle: 'dashed', color: 'var(--muted)' }}>+ 추가</button>
    </div>
  )
  const usesShown = p.desktop && !usesAll ? DUKMARK_USES.slice(0, PC_USES_SHOWN) : DUKMARK_USES
  const useChips = (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      {usesShown.map(u => {
        const sel = p.uses.includes(u.value)
        const full = !sel && p.uses.length >= DUKMARK_MAX_USES
        return (
          <button key={u.value} type="button" aria-pressed={sel} onClick={() => toggleUse(u.value)}
            style={{ ...(sel ? pillOn : pillOff), opacity: full ? 0.45 : 1 }}>{sel && <Check />}{u.label}</button>
        )
      })}
      {p.desktop && (
        <button type="button" onClick={() => setUsesAll(o => !o)} style={{ ...pillOff, border: 'none', color: 'var(--muted)', padding: '7px 6px' }}>
          {usesAll ? '접기' : '더보기'} <Chevron open={usesAll} />
        </button>
      )}
    </div>
  )
  const coverRow = (
    <div style={p.desktop ? boxRow : lineRow}>
      <button type="button" onClick={() => p.bodyImages.length > 0 && setCoverOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', border: 'none', background: 'none', padding: 0, cursor: p.bodyImages.length ? 'pointer' : 'default', fontFamily: 'inherit', color: 'var(--text)', textAlign: 'left' }}>
        {!p.desktop && <Chevron open={coverOpen} />}
        {p.desktop && <ImageIcon />}
        <span style={{ fontSize: 14, fontWeight: 800, flexShrink: 0 }}>대표 이미지</span>
        {!p.desktop && (shownCover
          ? <img src={shownCover} alt="" style={{ width: 56, height: 36, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
          : <span style={{ width: 56, height: 36, borderRadius: 6, background: 'var(--surface2)', flexShrink: 0 }} />)}
        <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--muted)' }}>
          {p.desktop && '· '}{p.coverUrl ? '직접 고른 이미지' : shownCover ? '본문 첫 이미지' : '본문에 사진이 없어요'}
          {p.desktop && p.bodyImages.length > 0 && <span style={{ marginLeft: 4 }}>›</span>}
        </span>
        {!p.desktop && p.bodyImages.length > 0 && <span style={{ fontSize: 13, color: 'var(--muted)' }}>변경 ›</span>}
      </button>
      {coverOpen && (
        <div className="taku-noscroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', marginTop: 10, paddingBottom: 2 }}>
          {p.bodyImages.map((src, i) => {
            const sel = (p.coverUrl ?? p.bodyImages[0]) === src
            return (
              <button key={src} type="button" aria-label={`${i + 1}번째 사진을 대표 이미지로`} onClick={() => { p.onCover(i === 0 ? null : src); setCoverOpen(false) }}
                style={{ flexShrink: 0, padding: 0, border: `2px solid ${sel ? 'var(--accent)' : 'transparent'}`, borderRadius: 10, background: 'none', cursor: 'pointer' }}>
                <img src={src} alt="" style={{ width: 72, height: 54, borderRadius: 8, objectFit: 'cover', display: 'block' }} />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
  const moreRow = (
    <div style={p.desktop ? boxRow : lineRow}>
      <button type="button" onClick={() => setMoreOpen(o => !o)} aria-expanded={moreOpen}
        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text)', textAlign: 'left' }}>
        {!p.desktop && <Chevron open={moreOpen} />}
        {p.desktop && <GearIcon />}
        <span style={{ fontSize: 14, fontWeight: 800 }}>추가 설정</span>
        {p.desktop && <Chevron open={moreOpen} />}
      </button>
      {moreOpen && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13.5, cursor: 'pointer', marginTop: 12 }}>
          <input type="checkbox" checked={p.byMaker} onChange={() => p.onByMaker(!p.byMaker)} style={{ width: 17, height: 17, accentColor: 'var(--accent)' }} />
          <span>직접 만든 사이트·서비스예요</span>
        </label>
      )}
    </div>
  )

  return (
    <div style={{ marginTop: 16 }}>
      {/* 켜기 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 12, background: 'var(--accent-l, rgba(255,86,146,.12))' }}>
        {p.desktop && <BookmarkIcon />}
        <span style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text)' }}>덕마크에 올리기</span>
        <span title="덕질 노하우 글에서만 올릴 수 있어요. 올리면 커뮤니티 덕마크 탭에 작품·용도별로 모여요." aria-label="덕마크 안내" style={{ display: 'inline-flex', color: 'var(--muted)', cursor: 'help' }}><InfoIcon /></span>
        <span style={{ flex: 1 }} />
        <button type="button" role="switch" aria-checked={p.on} aria-label="덕마크에 올리기" onClick={() => p.onToggle(!p.on)} className={`${controls.switch} ${p.on ? controls.switchOn : ''}`}>
          <span className={controls.knob} />
        </button>
      </div>

      {p.on && (p.desktop ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '18px 0 0' }}>
          <div style={pcRow}>
            <span style={pcLabel}>사이트</span>
            <div style={{ display: 'flex', gap: 10, flex: 1, minWidth: 0 }}>{siteList}{addSiteBtn(false)}</div>
          </div>
          <div style={pcRow}>
            <span style={pcLabel}>분류</span>
            <div style={{ display: 'flex', gap: 28, flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <div style={subLabel}>작품 선택</div>
                {workChips}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={subLabel}>용도 선택 <span style={{ fontWeight: 600 }}>· 최대 {DUKMARK_MAX_USES}개</span></div>
                {useChips}
              </div>
            </div>
          </div>
          {coverRow}
          {moreRow}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '18px 2px 0' }}>
          <div>
            <div style={label}>사이트</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{siteList}{addSiteBtn(true)}</div>
          </div>
          <div>
            <div style={label}>분류</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <span style={{ ...subLabel, marginBottom: 0, flexShrink: 0 }}>작품</span>
              {workChips}
            </div>
            <div style={subLabel}>용도 · 여러 개 선택 <span style={{ fontWeight: 600 }}>(최대 {DUKMARK_MAX_USES}개)</span></div>
            {useChips}
          </div>
          <div>
            {coverRow}
            {moreRow}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── 아이콘 (선 아이콘, 글자색 따라감) ──
const svg = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
function LinkIcon() { return <svg {...svg} style={{ color: 'var(--muted)', flexShrink: 0 }}><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></svg> }
function Check() { return <svg {...svg} width={14} height={14} strokeWidth={2.6} style={{ flexShrink: 0 }}><path d="m5 12 5 5L20 7" /></svg> }
function Chevron({ open }: { open: boolean }) { return <svg {...svg} width={14} height={14} strokeWidth={2.4} style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}><path d="m6 9 6 6 6-6" /></svg> }
function InfoIcon() { return <svg {...svg} width={15} height={15}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg> }
function BookmarkIcon() { return <svg {...svg} width={18} height={18} style={{ color: 'var(--accent)', flexShrink: 0 }}><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1z" /></svg> }
function ImageIcon() { return <svg {...svg} style={{ color: 'var(--muted)', flexShrink: 0 }}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.5" /><path d="m4 17 4.5-4.5 3 3L16 11l4 4.5" /></svg> }
function GearIcon() { return <svg {...svg} style={{ color: 'var(--muted)', flexShrink: 0 }}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg> }

// ── 스타일 ──
const label: React.CSSProperties = { fontSize: 14.5, fontWeight: 800, color: 'var(--text)', marginBottom: 10 }
const subLabel: React.CSSProperties = { fontSize: 12.5, fontWeight: 700, color: 'var(--muted)', marginBottom: 8 }
const pcRow: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: 16 }
const pcLabel: React.CSSProperties = { width: 72, flexShrink: 0, fontSize: 14.5, fontWeight: 800, color: 'var(--text)', paddingTop: 10 }
const siteRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 14, color: 'var(--text)' }
const xBtn: React.CSSProperties = { border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 18, lineHeight: 1, padding: 0, fontFamily: 'inherit', flexShrink: 0 }
const lineRow: React.CSSProperties = { padding: '14px 2px', borderTop: '1px solid var(--border)' }
const boxRow: React.CSSProperties = { padding: '12px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)' }
const pillBase: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }
const pillOn: React.CSSProperties = { ...pillBase, border: '1px solid var(--accent)', background: 'var(--accent-l, rgba(255,86,146,.12))', color: 'var(--accent)' }
const pillOff: React.CSSProperties = { ...pillBase, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }
