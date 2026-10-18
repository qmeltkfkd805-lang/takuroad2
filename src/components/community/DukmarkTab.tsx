'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import LogoLoader from '@/components/common/LogoLoader'
import DukmarkCardView from './DukmarkCardView'
import DukmarkMark from './DukmarkMark'
import { getDukmarkCards } from '@/services/dukmarkService'
import { getSavedPostIds, setPostSaved } from '@/services/communityPostService'
import { getMyWorkRelationships } from '@/services/workRelationshipService'
import { dukmarkSummary } from '@/lib/utils/dukmark'
import { CommunityPost, DukmarkCard, DUKMARK_USES, DUKMARK_USE_LABEL } from '@/types/community-post'

/* 커뮤니티 › 덕마크 탭 (시안 2026-10-18)
   덕마크 검색 + [작품 전체 ▾] [용도 전체 ▾] (모바일: 아래에서 올라오는 시트 / PC: 버튼 아래 팝오버) + 'N개의 덕마크 · 최신순 ▾' + 카드
   덕마크는 아직 적어서 한 번에 받아 두고 화면에서 거른다. */

type WorkSel = 'all' | 'mine' | 'common' | string   // string = 작품 id
type SortKey = 'latest' | 'saves' | 'likes'
const SORTS: { value: SortKey; label: string }[] = [
  { value: 'latest', label: '최신순' }, { value: 'saves', label: '저장순' }, { value: 'likes', label: '좋아요순' },
]

interface Props {
  desktop: boolean
  userId: string | null
  tags: { id: string; name: string }[]     // 작품 이름 찾기용 (커뮤니티 화면이 받아 둔 목록)
  onOpen: (p: CommunityPost) => void
  onNeedLogin: () => void
}

let cache: DukmarkCard[] | null = null   // 탭을 오갈 때 바로 보이게 (새로고침하면 비워짐)

export default function DukmarkTab({ desktop, userId, tags, onOpen, onNeedLogin }: Props) {
  const [cards, setCards] = useState<DukmarkCard[] | null>(cache)
  const [failed, setFailed] = useState(false)
  const [saved, setSaved] = useState<Set<string>>(new Set())
  const [myWorkIds, setMyWorkIds] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [work, setWork] = useState<WorkSel>('all')
  const [use, setUse] = useState<string>('all')
  const [sort, setSort] = useState<SortKey>('latest')
  const [open, setOpen] = useState<null | 'work' | 'use' | 'sort'>(null)

  const load = () => {
    setFailed(false)
    getDukmarkCards(userId).then(list => { cache = list; setCards(list) }).catch(() => setFailed(true))
  }
  useEffect(load, [userId])   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!userId || !cards?.length) { setSaved(new Set()); return }
    getSavedPostIds(userId, cards.map(c => c.post.id)).then(setSaved)
  }, [userId, cards])

  useEffect(() => {
    if (!userId) { setMyWorkIds(new Set()); return }
    getMyWorkRelationships(userId).then(rels => setMyWorkIds(new Set(rels.filter(r => r.affinity).map(r => r.work.id)))).catch(() => {})
  }, [userId])

  const nameOf = useMemo(() => new Map(tags.map(t => [t.id, t.name])), [tags])
  const workIdsOf = (c: DukmarkCard) => c.post.tagIds?.length ? c.post.tagIds : (c.post.tagId ? [c.post.tagId] : [])
  const workNamesOf = (c: DukmarkCard) => {
    const names = workIdsOf(c).map(id => nameOf.get(id)).filter((n): n is string => !!n)
    return names.length ? names : (c.post.work ? [c.post.work.name] : [])
  }

  // 작품 고르기 목록 = 덕마크에 실제로 있는 작품들 (많이 쓰인 순)
  const workOptions = useMemo(() => {
    const count = new Map<string, number>()
    for (const c of cards ?? []) for (const id of workIdsOf(c)) count.set(id, (count.get(id) ?? 0) + 1)
    return [...count.entries()]
      .map(([id, n]) => ({ id, name: nameOf.get(id) ?? '', n }))
      .filter(w => w.name)
      .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name, 'ko'))
  }, [cards, nameOf])

  const shown = useMemo(() => {
    const kw = query.trim().toLowerCase()
    const list = (cards ?? []).filter(c => {
      const ids = workIdsOf(c)
      if (work === 'common' && ids.length > 0) return false
      if (work === 'mine' && !ids.some(id => myWorkIds.has(id))) return false
      if (work !== 'all' && work !== 'common' && work !== 'mine' && !ids.includes(work)) return false
      if (use !== 'all' && !c.dukmark.uses.includes(use as never)) return false
      if (kw) {
        const hay = [c.post.title ?? '', dukmarkSummary(c.post, c.dukmark, 400), c.dukmark.siteUrls.join(' '), workNamesOf(c).join(' '), c.post.author?.nickname ?? ''].join(' ').toLowerCase()
        if (!hay.includes(kw)) return false
      }
      return true
    })
    if (sort === 'saves') list.sort((a, b) => b.dukmark.saveCount - a.dukmark.saveCount)
    if (sort === 'likes') list.sort((a, b) => b.post.likeCount - a.post.likeCount)
    return list
  }, [cards, query, work, use, sort, myWorkIds, nameOf])   // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSave = async (c: DukmarkCard) => {
    if (!userId) { onNeedLogin(); return }
    const next = !saved.has(c.post.id)
    const flip = (on: boolean) => {
      setSaved(prev => { const s = new Set(prev); if (on) s.add(c.post.id); else s.delete(c.post.id); return s })
      setCards(prev => prev?.map(x => x.post.id === c.post.id ? { ...x, dukmark: { ...x.dukmark, saveCount: Math.max(0, x.dukmark.saveCount + (on ? 1 : -1)) } } : x) ?? prev)
    }
    flip(next)
    if (!(await setPostSaved(c.post.id, userId, next))) flip(!next)
  }

  const workLabel = work === 'all' ? '작품 전체' : work === 'mine' ? '내 최애 작품' : work === 'common' ? '전체 공통' : (nameOf.get(work) ?? '작품')
  const useLabel = use === 'all' ? '용도 전체' : (DUKMARK_USE_LABEL[use] ?? '용도')

  const workChoices: { value: WorkSel; label: string }[] = [
    { value: 'all', label: '전체 작품' },
    ...(userId ? [{ value: 'mine' as WorkSel, label: '내 최애 작품' }] : []),
    ...workOptions.map(w => ({ value: w.id, label: w.name })),
    { value: 'common', label: '전체 공통' },
  ]
  const useChoices = [{ value: 'all', label: '용도 전체' }, ...DUKMARK_USES.map(u => ({ value: u.value as string, label: u.label }))]

  const filterBtn = (kind: 'work' | 'use', label: string, active: boolean) => (
    <div style={{ position: 'relative', flex: desktop ? undefined : 1 }}>
      <button type="button" onClick={() => setOpen(o => o === kind ? null : kind)} aria-expanded={open === kind}
        style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: desktop ? '8px 14px' : '10px 12px', borderRadius: 10, border: `1px solid ${active || open === kind ? 'var(--accent)' : 'var(--border)'}`, background: 'var(--surface)', color: active ? 'var(--accent)' : 'var(--text)', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', minWidth: desktop ? 128 : 0 }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span><Chevron />
      </button>
      {desktop && open === kind && (
        <ChoicePanel desktop title={kind === 'work' ? '작품 선택' : '용도 선택'} searchable={kind === 'work'}
          choices={kind === 'work' ? workChoices : useChoices} value={kind === 'work' ? work : use}
          onApply={v => { if (kind === 'work') setWork(v); else setUse(v); setOpen(null) }} onClose={() => setOpen(null)} />
      )}
    </div>
  )

  const searchBox = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: desktop ? '8px 13px' : '11px 14px', borderRadius: desktop ? 10 : 12, border: desktop ? '1px solid var(--border)' : 'none', background: desktop ? 'var(--surface)' : 'var(--surface2)', flex: desktop ? '0 1 300px' : undefined, minWidth: desktop ? 180 : 0 }}>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
      <input value={query} onChange={e => setQuery(e.target.value)} placeholder="덕마크 검색" aria-label="덕마크 검색" style={{ flex: 1, minWidth: 0, border: 'none', background: 'none', outline: 'none', fontSize: 14, color: 'var(--text)', fontFamily: 'inherit' }} />
      {query && <button type="button" onClick={() => setQuery('')} aria-label="지우기" style={{ border: 'none', background: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>}
    </div>
  )

  const sortMenu = (
    <div style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(o => o === 'sort' ? null : 'sort')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: 'var(--text)', padding: 0 }}>
        {SORTS.find(s => s.value === sort)?.label}<Chevron />
      </button>
      {open === 'sort' && (
        <div style={{ position: 'absolute', top: '100%', right: 0, zIndex: 30, marginTop: 6, minWidth: 120, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.12)', padding: 6 }}>
          {SORTS.map(s => (
            <button key={s.value} type="button" onClick={() => { setSort(s.value); setOpen(null) }} style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: sort === s.value ? 'var(--accent-l, rgba(255,86,146,.12))' : 'none', color: sort === s.value ? 'var(--accent)' : 'var(--text)', padding: '9px 11px', borderRadius: 7, fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{s.label}</button>
          ))}
        </div>
      )}
    </div>
  )

  const filtered = work !== 'all' || use !== 'all' || !!query.trim()
  const body = cards === null
    ? (failed
      ? <div style={emptyBox}><p style={{ margin: '0 0 14px' }}>덕마크를 불러오지 못했어요.</p><button type="button" onClick={load} style={retryBtn}>다시 시도</button></div>
      : <LogoLoader size="sm" />)
    : shown.length === 0
      ? <div style={emptyBox}>{filtered ? '조건에 맞는 덕마크가 없어요.' : '아직 덕마크가 없어요. 덕질 노하우 글을 쓸 때 [덕마크에 올리기]를 켜 보세요.'}</div>
      : (
        <div style={desktop
          ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 16 }
          : { display: 'flex', flexDirection: 'column', gap: 14 }}>
          {shown.map(c => (
            <DukmarkCardView key={c.post.id} card={c} variant={desktop ? 'grid' : 'wide'} workNames={workNamesOf(c)}
              saved={saved.has(c.post.id)} onToggleSave={() => toggleSave(c)} onOpen={() => onOpen(c.post)} />
          ))}
        </div>
      )

  return (
    <div>
      {desktop ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 20px', borderRadius: 14, background: 'var(--accent-l, rgba(255,86,146,.08))', marginBottom: 16 }}>
          {/* 제목 + 그 아래 한 줄 설명 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: '1 0 auto', minWidth: 0 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 21, fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.25, whiteSpace: 'nowrap' }}><DukmarkMark size={21} />덕마크</span>
            <span style={{ fontSize: 13, color: 'var(--muted)', whiteSpace: 'nowrap' }}>유저들이 함께 채우는 덕질 북마크</span>
          </div>
          {searchBox}
          {filterBtn('work', workLabel, work !== 'all')}
          {filterBtn('use', useLabel, use !== 'all')}
        </div>
      ) : (
        <div style={{ padding: '18px 16px 4px', background: 'var(--surface)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em' }}><DukmarkMark size={22} />덕마크</div>
          <div style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 2, marginBottom: 14 }}>유저들이 함께 채우는 덕질 북마크</div>
          {searchBox}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {filterBtn('work', workLabel, work !== 'all')}
            {filterBtn('use', useLabel, use !== 'all')}
          </div>
        </div>
      )}

      <div style={{ padding: desktop ? 0 : '14px 16px 0', background: desktop ? undefined : 'var(--surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 14.5, fontWeight: 800 }}>{cards ? `${shown.length}개의 덕마크` : '덕마크'}</span>
          {sortMenu}
        </div>
        {body}
        {!desktop && <div style={{ height: 16 }} />}
      </div>

      {/* 📱 작품·용도 고르기 — 아래에서 올라오는 시트 */}
      {!desktop && (open === 'work' || open === 'use') && typeof document !== 'undefined' && createPortal(
        <div onClick={() => setOpen(null)} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%' }}>
            <ChoicePanel desktop={false} title={open === 'work' ? '작품 선택' : '용도 선택'} searchable={open === 'work'}
              choices={open === 'work' ? workChoices : useChoices} value={open === 'work' ? work : use}
              onApply={v => { if (open === 'work') setWork(v); else setUse(v); setOpen(null) }} onClose={() => setOpen(null)} />
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

/* 라디오 목록 + [적용하기] — 모바일 시트와 PC 팝오버가 같이 쓴다 */
function ChoicePanel({ desktop, title, searchable, choices, value, onApply, onClose }: {
  desktop: boolean; title: string; searchable: boolean
  choices: { value: string; label: string }[]; value: string
  onApply: (v: string) => void; onClose: () => void
}) {
  const [pick, setPick] = useState(value)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  // PC 팝오버: 바깥을 누르면 닫는다
  useEffect(() => {
    if (!desktop) return
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node) && !(e.target as HTMLElement).closest('[aria-expanded="true"]')) onClose() }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [desktop, onClose])
  const kw = q.trim().toLowerCase()
  const list = kw ? choices.filter(c => c.label.toLowerCase().includes(kw)) : choices

  return (
    <div ref={ref} role="dialog" aria-label={title} style={desktop
      ? { position: 'absolute', top: '100%', right: 0, zIndex: 30, marginTop: 6, width: 260, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: '0 10px 30px rgba(0,0,0,.14)', padding: 16 }
      : { background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '10px 20px calc(18px + env(safe-area-inset-bottom))', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
      {!desktop && <div style={{ width: 40, height: 4, borderRadius: 9999, background: 'var(--border)', margin: '0 auto 14px' }} />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: desktop ? 15 : 19, fontWeight: 900 }}>{title}</span>
        {!desktop && <button type="button" onClick={onClose} aria-label="닫기" style={{ border: 'none', background: 'none', fontSize: 24, lineHeight: 1, color: 'var(--muted)', cursor: 'pointer', padding: 0 }}>×</button>}
      </div>
      {searchable && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: desktop ? '8px 11px' : '12px 14px', borderRadius: 10, border: desktop ? '1px solid var(--border)' : 'none', background: desktop ? 'var(--surface)' : 'var(--surface2)', marginBottom: 6 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="작품 이름 검색" style={{ flex: 1, minWidth: 0, border: 'none', background: 'none', outline: 'none', fontSize: 14, color: 'var(--text)', fontFamily: 'inherit' }} />
        </div>
      )}
      <div className="taku-noscroll" style={{ overflowY: 'auto', maxHeight: desktop ? 240 : undefined, flex: desktop ? undefined : 1 }}>
        {list.map(c => {
          const on = pick === c.value
          return (
            <label key={c.value} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: desktop ? '8px 2px' : '15px 2px', borderBottom: desktop ? 'none' : '1px solid var(--border)', cursor: 'pointer', fontSize: desktop ? 14 : 16, fontWeight: on ? 800 : 600, color: on ? 'var(--accent)' : 'var(--text)' }}>
              <input type="radio" name={title} checked={on} onChange={() => setPick(c.value)} style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} />
              <span aria-hidden style={{ width: desktop ? 18 : 24, height: desktop ? 18 : 24, borderRadius: 9999, border: `2px solid ${on ? 'var(--accent)' : 'var(--border)'}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {on && <span style={{ width: desktop ? 8 : 11, height: desktop ? 8 : 11, borderRadius: 9999, background: 'var(--accent)' }} />}
              </span>
              {c.label}
            </label>
          )
        })}
        {list.length === 0 && <div style={{ padding: '14px 2px', fontSize: 13.5, color: 'var(--muted)' }}>결과 없음</div>}
      </div>
      <button type="button" onClick={() => onApply(pick)} style={{ marginTop: 14, width: '100%', padding: desktop ? '11px' : '15px', borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: desktop ? 14.5 : 16, cursor: 'pointer', fontFamily: 'inherit' }}>적용하기</button>
    </div>
  )
}

function Chevron() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="m6 9 6 6 6-6" /></svg>
}

const emptyBox: React.CSSProperties = { border: '1px dashed var(--border)', borderRadius: 14, padding: '44px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: 14, lineHeight: 1.6 }
const retryBtn: React.CSSProperties = { padding: '10px 18px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }
