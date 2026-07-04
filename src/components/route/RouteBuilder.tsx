'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useAuth } from '@/components/layout/AuthProvider'
import { getAllTagsFull, AdminTag } from '@/services/workAdminService'
import { getShopsByTag, getShops, getSavedShops } from '@/services/shopService'
import { createRoute, uploadRouteCover, updateRouteMeta, updateRoute, getRouteForEdit, getRouteMeta, deleteRoute, toggleRouteShare } from '@/services/routeService'
import { useRouter } from 'next/navigation'
import { shopRegion } from '@/lib/shop/quickCompleteness'
import { Shop } from '@/types/shop'
import RouteMiniMap from '@/components/admin/RouteMiniMap'

const DIFF = [
  { v: 1, l: '가볍게', c: '#0E7A63' },
  { v: 2, l: '반나절', c: '#835700' },
  { v: 3, l: '하루 코스', c: '#A23E18' },
]
const THEMES = ['카페', '굿즈', '사진명소', '가족', '커플', '혼자', '실내', '비오는날', '친구', '가챠', '쿠지', '전시', '게임', '만화카페']
const STEPS = [
  { n: 1, label: '샵 불러오기' },
  { n: 2, label: '코스 담기' },
  { n: 3, label: '루트 정보' },
  { n: 4, label: '테마 & 추천' },
  { n: 5, label: '확인 & 저장' },
]

/* ---- 아이콘 ---- */
function MaskIcon({ name, size = 16, color = 'currentColor', style }: { name: string; size?: number; color?: string; style?: React.CSSProperties }) {
  return <span aria-hidden style={{ width: size, height: size, display: 'inline-block', flexShrink: 0, verticalAlign: '-2px', backgroundColor: color, WebkitMaskImage: `url(/icons/${name}.png)`, maskImage: `url(/icons/${name}.png)`, WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat', WebkitMaskSize: 'contain', maskSize: 'contain', WebkitMaskPosition: 'center', maskPosition: 'center', ...style }} />
}
function Svg({ size = 16, color = 'currentColor', fill = 'none', style, children }: { size?: number; color?: string; fill?: string; style?: React.CSSProperties; children: React.ReactNode }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0, verticalAlign: '-2px', ...style }}>{children}</svg>
}
const THEME_PNG: Record<string, string> = { '카페': 'cafe', '굿즈': 'goods', '가챠': 'gacha', '사진명소': 'photo', '도보30분': 'route', '반나절': 'clock' }
function ThemeIcon({ size = 14, color = 'currentColor' }: { name?: string; size?: number; color?: string }) {
  const sp = { size, color }
  return <Svg {...sp}><path d="M4 4h9l7 7-9 9-7-7Z" /><circle cx="8" cy="8" r="1.3" /></Svg>
}
function DiffIcon({ v, color }: { v: number; color: string }) {
  if (v === 1) return <Svg color={color}><path d="M12 20V9" /><path d="M12 9c0-3 2-5 5-5 0 3-2 5-5 5Z" /><path d="M12 12c0-2.5-1.8-4.5-4.5-4.5 0 2.7 2 4.5 4.5 4.5Z" /></Svg>
  if (v === 2) return <Svg color={color}><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" /></Svg>
  return <Svg color={color}><path d="M20 14.5A7 7 0 0 1 9.5 4 7 7 0 1 0 20 14.5Z" /></Svg>
}
const PinIcon = (p: { size?: number; color?: string }) => <Svg {...p}><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></Svg>
const CheckIcon = (p: { size?: number; color?: string }) => <Svg {...p}><path d="m5 12 5 5L20 6" /></Svg>
const BulbIcon = (p: { size?: number; color?: string }) => <Svg {...p}><path d="M9 18h6" /><path d="M10 21h4" /><path d="M8.5 14a5 5 0 1 1 7 0c-.6.6-1 1.3-1 2.2h-5c0-.9-.4-1.6-1-2.2Z" /></Svg>

type SourceMode = 'work' | 'region' | 'saved'

export default function RouteBuilder({ mode = 'create', editRouteId = null, editToken = null, ownerId = null, initialShared = false, lastEdited = null }: { mode?: 'create' | 'edit'; editRouteId?: string | null; editToken?: string | null; ownerId?: string | null; initialShared?: boolean; lastEdited?: string | null } = {}) {
  const router = useRouter()
  const { user } = useAuth()

  const [step, setStep] = useState(1)
  const [sourceMode, setSourceMode] = useState<SourceMode>('work')
  const [tags, setTags] = useState<AdminTag[]>([])
  const [tagQuery, setTagQuery] = useState('')
  const [selectedTag, setSelectedTag] = useState<AdminTag | null>(null)
  const [candidates, setCandidates] = useState<Shop[]>([])
  const [loadingShops, setLoadingShops] = useState(false)
  const [query, setQuery] = useState('')
  const [added, setAdded] = useState<Shop[]>([])
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [difficulty, setDifficulty] = useState(1)
  const [coverUrl, setCoverUrl] = useState('')
  const [themes, setThemes] = useState<string[]>([])
  const [target, setTarget] = useState('')
  const [tips, setTips] = useState('')
  const [uploading, setUploading] = useState(false)
  const [primaryTagId, setPrimaryTagId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const [saving, setSaving] = useState(false)
  const editing = mode === 'edit'
  const [shared, setShared] = useState(initialShared)
  const [loadingEdit, setLoadingEdit] = useState(mode === 'edit')
  const [shareBusy, setShareBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => { getAllTagsFull().then(setTags).catch(() => {}) }, [])

  // 편집 모드: 기존 데이터 불러오기
  useEffect(() => {
    if (mode !== 'edit' || !editRouteId) return
    let alive = true
    getRouteForEdit(editRouteId).then((r: any) => {
      if (!alive) return
      if (r) {
        setTitle(r.title ?? ''); setDesc(r.description ?? ''); setDifficulty(r.official_difficulty ?? 1)
        const shops = (r.route_shops ?? []).slice().sort((a: any, b: any) => a.sort_order - b.sort_order).map((rs: any) => rs.shops).filter((s: any) => s && s.lat != null && s.lng != null)
        setAdded(shops as Shop[])
      }
      setLoadingEdit(false)
    }).catch(() => setLoadingEdit(false))
    getRouteMeta(editRouteId).then((m: any) => {
      if (!alive) return
      setCoverUrl(m.cover ?? ''); setThemes(m.themes ?? [])
      setTarget(m.target ? String(m.target).split('\n').map((l: string) => '- ' + l).join('\n') : '')
      setTips(m.tips ? String(m.tips).split('\n').map((l: string) => '- ' + l).join('\n') : '')
      setPrimaryTagId(m.primaryTag ?? null)
    }).catch(() => {})
    return () => { alive = false }
  }, [mode, editRouteId])

  function switchMode(m: SourceMode) {
    if (m === sourceMode) return
    setSourceMode(m); setQuery(''); setSelectedTag(null); setCandidates([])
  }

  useEffect(() => {
    if (sourceMode === 'work') return
    setLoadingShops(true)
    const p = sourceMode === 'region' ? getShops() : (user ? getSavedShops(user.id) : Promise.resolve([]))
    p.then((shops) => setCandidates((shops as Shop[]).filter((s) => s.lat != null && s.lng != null)))
      .catch(() => setCandidates([]))
      .finally(() => setLoadingShops(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceMode])

  async function pickTag(t: AdminTag) {
    setSelectedTag(t); setTagQuery(''); setQuery(''); setLoadingShops(true)
    setPrimaryTagId(t.id)
    const shops = await getShopsByTag(t.slug).catch(() => [])
    setCandidates(shops.filter((s) => s.lat != null && s.lng != null))
    setLoadingShops(false)
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setUploading(true)
    const url = await uploadRouteCover(file, user.id, 'new')
    setUploading(false)
    if (url) setCoverUrl(url); else setMsg('이미지 업로드 실패')
    if (fileRef.current) fileRef.current.value = ''
  }
  function toggleTheme(t: string) { setThemes((a) => a.includes(t) ? a.filter((x) => x !== t) : [...a, t]) }

  const q = query.trim().toLowerCase()
  const filtered = useMemo(() => {
    if (!q) return candidates
    return candidates.filter((s) => (s.name ?? '').toLowerCase().includes(q) || (s.addr ?? '').toLowerCase().includes(q) || shopRegion(s).toLowerCase().includes(q))
  }, [candidates, q])
  const addedIds = useMemo(() => new Set(added.map((s) => s.id)), [added])

  function add(s: Shop) { if (!addedIds.has(s.id)) setAdded((a) => [...a, s]) }
  function addAll() { setAdded((a) => { const ids = new Set(a.map((x) => x.id)); return [...a, ...filtered.filter((s) => !ids.has(s.id))] }) }
  function remove(id: string) { setAdded((a) => a.filter((s) => s.id !== id)) }
  function move(i: number, dir: -1 | 1) {
    setAdded((a) => { const j = i + dir; if (j < 0 || j >= a.length) return a; const c = [...a]; [c[i], c[j]] = [c[j], c[i]]; return c })
  }
  function moveTo(target2: number) {
    setAdded((a) => { if (dragIndex == null || dragIndex === target2) return a; const c = [...a]; const [m] = c.splice(dragIndex, 1); c.splice(target2, 0, m); return c })
    setDragIndex(null)
  }

  const tagMatches = tagQuery.trim() ? tags.filter((t) => t.name.includes(tagQuery.trim())).slice(0, 8) : []
  const mapStops = useMemo(() => added.map((s) => ({ id: s.id, lat: s.lat as number, lng: s.lng as number, name: s.name })), [added])
  const showCandidates = sourceMode !== 'work' || !!selectedTag

  // 추천 제목 (선택 작품/지역/테마/난이도 기반, 자동입력 아님)
  const suggestions = useMemo(() => {
    const work = selectedTag?.name
    const counts: Record<string, number> = {}
    added.forEach((s) => { const r = shopRegion(s); if (r && r !== '지역 미정') counts[r] = (counts[r] || 0) + 1 })
    const region = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
    const out: string[] = []
    if (work && region) out.push(`${region} ${work} 투어`)
    if (work) { out.push(`${work} 성지순례`); out.push(`${work} 입문 루트`); out.push(`${work} 굿즈 코스`) }
    if (region) { out.push(`${region} 굿즈 투어`); if (difficulty === 2) out.push(`${region} 반나절 코스`); if (difficulty === 3) out.push(`${region} 하루 코스`) }
    if (themes.includes('커플')) out.push('커플 데이트 코스')
    if (themes.includes('가족')) out.push('가족 나들이 코스')
    if (themes.includes('비오는날') || themes.includes('실내')) out.push('비 오는 날 실내 루트')
    if (out.length === 0) return ['굿즈 투어', '반나절 코스', '성지순례 루트']
    return Array.from(new Set(out)).slice(0, 5)
  }, [selectedTag, added, themes, difficulty])

  const guide = [
    { label: '루트 이름 짓기', ok: !!title.trim() },
    { label: '대표 이미지 추가', ok: !!coverUrl },
    { label: '스팟 2곳 이상 담기', ok: added.length >= 2 },
    { label: '테마·추천 대상 설정', ok: themes.length > 0 || !!target.trim() },
  ]

  async function save() {
    if (!user) return
    if (!title.trim()) { setMsg('루트 이름을 입력하세요'); setStep(3); return }
    if (added.length < 2) { setMsg('샵을 2개 이상 담아주세요'); setStep(2); return }
    setSaving(true); setMsg(null)
    const shopInput = added.map((s) => ({ shopId: s.id, lat: s.lat as number, lng: s.lng as number }))
    const meta = {
      cover_image_url: coverUrl || null,
      themes,
      target_audience: (target.split('\n').map((l) => l.replace(/^\s*[-•*]\s*/, '').trim()).filter(Boolean).join('\n')) || null,
      tips: (tips.split('\n').map((l) => l.replace(/^\s*[-•*]\s*/, '').trim()).filter(Boolean).join('\n')) || null,
      primary_tag_id: primaryTagId,
    }
    if (editing && editRouteId) {
      const ok = await updateRoute(editRouteId, title.trim(), desc.trim(), difficulty, shopInput)
      if (!ok) { setSaving(false); setMsg('수정 저장 실패'); return }
      await updateRouteMeta(editRouteId, meta)
      setSaving(false)
      router.push(`/route/${editToken}`)
      return
    }
    const res = await createRoute(user.id, title.trim(), desc.trim(), shopInput, difficulty)
    if (!res) { setSaving(false); setMsg('루트 생성 실패'); return }
    await updateRouteMeta(res.id, meta)
    setSaving(false)
    router.push(`/route/${res.shareToken}`)
  }

  async function toggleShared() {
    if (!user || !editRouteId || shareBusy) return
    setShareBusy(true)
    const next = !shared
    const ok = await toggleRouteShare(editRouteId, user.id, next)
    setShareBusy(false)
    if (ok) setShared(next)
  }
  async function doDelete() {
    if (!user || !editRouteId) return
    if (!confirm('이 루트를 삭제할까요? 되돌릴 수 없어요.')) return
    const ok = await deleteRoute(editRouteId, user.id)
    if (ok) router.push('/routes')
    else setMsg('삭제 실패')
  }

  if (!user) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>로그인하면 루트를 만들 수 있어요.</div>
  if (editing && loadingEdit) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>루트 불러오는 중...</div>
  if (editing && ownerId && user.id !== ownerId) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>이 루트를 수정할 권한이 없어요.</div>

  const searchPlaceholder = sourceMode === 'saved' ? '저장한 샵에서 검색 (이름·지역)' : '지역·이름 검색 (예: 홍대, 강남)'
  const diffMeta = DIFF.find((d) => d.v === difficulty)!
  // 단계별 완료 조건 + 미완료 사유
  function stepIssue(n: number): string | null {
    if (n === 1) return added.length >= 2 ? null : '샵을 2곳 이상 담아주세요'
    if (n === 2) return added.length >= 2 ? null : '샵을 2곳 이상 담아야 루트가 돼요'
    if (n === 3) {
      if (!title.trim()) return '루트 이름을 입력해주세요'
      if (!coverUrl) return '대표 이미지를 추가해주세요'
      return null
    }
    if (n === 4) return themes.length >= 1 ? null : '테마를 1개 이상 선택해주세요'
    return null
  }
  const stepDone = (n: number) => stepIssue(n) === null
  const curIssue = stepIssue(step)
  const canNext = curIssue === null
  // 스텝바 이동: 현재까지 다 완료했거나, 이미 지난(완료된) 단계로만 이동 허용
  function goToStep(target: number) {
    if (target <= step) { setStep(target); setMsg(null); return }
    for (let n = step; n < target; n++) {
      const iss = stepIssue(n)
      if (iss) { setStep(n); setMsg(iss); return }
    }
    setStep(target); setMsg(null)
  }

  return (
    <div style={{ maxWidth: 1320, margin: '0 auto', padding: '20px 32px' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => router.push('/routes')} style={iconBtn} aria-label="뒤로"><Svg><path d="m15 18-6-6 6-6" /></Svg></button>
          <div><h1 style={{ fontSize: 26, fontWeight: 900, margin: 0 }}>{editing ? '루트 수정' : '루트 만들기'}</h1>{editing && lastEdited && <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>마지막 수정: {new Date(lastEdited).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => router.push('/routes')} style={ghostBtn}>나가기</button>
        </div>
      </div>

      {/* 스텝바 */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 28, paddingBottom: 6 }}>
        {STEPS.map((s) => {
          const active = step === s.n
          const done = step > s.n
          const incomplete = step > s.n && !stepDone(s.n)
          return (
            <button key={s.n} onClick={() => goToStep(s.n)} style={{ flex: '1 0 auto', display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', borderBottom: `3px solid ${active ? 'var(--accent)' : 'transparent'}` }}>
              <span style={{ width: 28, height: 28, borderRadius: 9999, flexShrink: 0, fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', background: incomplete ? 'var(--red)' : (active || done ? 'var(--accent)' : 'var(--surface2)'), color: (incomplete || active || done) ? '#fff' : 'var(--muted)' }}>{incomplete ? '!' : (done ? <CheckIcon size={12} color="#fff" /> : s.n)}</span>
              <span style={{ fontSize: 15, fontWeight: active ? 800 : 600, color: active ? 'var(--text)' : 'var(--muted)', whiteSpace: 'nowrap' }}>{s.label}</span>
            </button>
          )
        })}
      </div>

      {/* 본문 2단 */}
      <div>
        {/* 왼쪽: 폼 */}
        <div style={{ border: '1px solid var(--border)', borderRadius: 18, padding: 32, background: 'var(--surface)' }}>
          {/* 작성 가이드 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 22, padding: '12px 14px', background: 'var(--surface2)', borderRadius: 12 }}>
            <span style={{ fontSize: 12.5, fontWeight: 900, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 5, marginRight: 2 }}><MaskIcon name="star" size={15} color="var(--accent)" />작성 가이드</span>
            {guide.map((g) => (
              <span key={g.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, padding: '6px 11px', borderRadius: 9999, background: 'var(--surface)', border: `1px solid ${g.ok ? 'var(--accent)' : 'var(--border)'}`, color: g.ok ? 'var(--accent)' : 'var(--muted)' }}>
                <span style={{ width: 16, height: 16, borderRadius: 9999, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: g.ok ? 'var(--accent)' : 'var(--surface2)' }}>{g.ok ? <CheckIcon size={11} color="#fff" /> : <span style={{ width: 5, height: 5, borderRadius: 9999, background: 'var(--muted)' }} />}</span>
                {g.label}
              </span>
            ))}
          </div>
          {/* STEP 1 — 샵 불러오기 */}
          {step === 1 && (
            <>
              <StepHead icon={<MaskIcon name="shop" size={20} color="var(--accent)" />} title="어디서 샵을 가져올까요?" sub="작품·지역·저장한 샵 중에서 골라 담을 준비를 해요." />
              <Label>샵 불러오기 방식</Label>
              <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                <button onClick={() => switchMode('work')} style={modeBtn(sourceMode === 'work')}>작품별</button>
                <button onClick={() => switchMode('region')} style={modeBtn(sourceMode === 'region')}>지역별</button>
                <button onClick={() => switchMode('saved')} style={modeBtn(sourceMode === 'saved')}>저장한 샵</button>
              </div>

              {sourceMode === 'work' && (
                <>
                  <Label>작품 선택</Label>
                  {selectedTag ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 800 }}><MaskIcon name="star" size={15} color="var(--accent)" />{selectedTag.name}</span>
                      <button onClick={() => { setSelectedTag(null); setCandidates([]) }} style={smallBtn}>변경</button>
                    </div>
                  ) : (
                    <div style={{ position: 'relative', marginBottom: 12 }}>
                      <input value={tagQuery} onChange={(e) => setTagQuery(e.target.value)} placeholder="작품 이름 검색" style={inp} />
                      {tagMatches.length > 0 && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, marginTop: 4, overflow: 'hidden' }}>
                          {tagMatches.map((t) => (
                            <button key={t.id} onClick={() => pickTag(t)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, color: 'var(--text)' }}>{t.name}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {showCandidates && (
                <>
                  <Label>{sourceMode === 'saved' ? '저장한 샵' : '샵 검색'}</Label>
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={searchPlaceholder} style={{ ...inp, marginBottom: 10 }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>{loadingShops ? '불러오는 중...' : `${filtered.length}개 샵 · 담김 ${added.length}`}</span>
                    {filtered.length > 0 && <button onClick={addAll} style={smallBtn}>전체 담기</button>}
                  </div>
                  <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
                    {filtered.map((s) => (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{shopRegion(s)}</div>
                        </div>
                        <button onClick={() => add(s)} disabled={addedIds.has(s.id)} style={{ ...smallBtn, opacity: addedIds.has(s.id) ? 0.4 : 1 }}>{addedIds.has(s.id) ? '담김' : '담기'}</button>
                      </div>
                    ))}
                    {!loadingShops && filtered.length === 0 && <div style={{ padding: 16, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>{sourceMode === 'saved' ? '저장한 샵이 없어요' : sourceMode === 'work' ? '작품을 먼저 선택하세요' : '검색 결과가 없어요'}</div>}
                  </div>
                </>
              )}
            </>
          )}

          {/* STEP 2 — 코스 담기 / 순서 */}
          {step === 2 && (
            <>
              <StepHead icon={<PinIcon size={20} color="var(--accent)" />} title="코스 순서를 정해요" sub="드래그하거나 화살표로 순서를 바꿀 수 있어요. (2곳 이상)" />
              {added.length >= 2 && (
                <div style={{ marginBottom: 16 }}><RouteMiniMap stops={mapStops} /></div>
              )}
              <Label>루트 순서 ({added.length}) · 드래그로 이동</Label>
              {added.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 13, border: '1px dashed var(--border)', borderRadius: 10 }}>1단계에서 샵을 담아주세요</div>
              ) : (
                <div>
                  {added.map((s, i) => (
                    <div key={s.id} draggable onDragStart={() => setDragIndex(i)} onDragOver={(e) => e.preventDefault()} onDrop={() => moveTo(i)} onDragEnd={() => setDragIndex(null)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 4px', borderBottom: '1px solid var(--border)', background: dragIndex === i ? 'var(--surface2)' : 'transparent', cursor: 'grab' }}>
                      <span style={{ color: 'var(--muted)', flexShrink: 0 }}><Svg size={15}><path d="M4 8h16M4 16h16" /></Svg></span>
                      <span style={{ width: 22, height: 22, borderRadius: 9999, background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span>
                      <button onClick={() => move(i, -1)} disabled={i === 0} style={{ ...smallBtn, opacity: i === 0 ? 0.3 : 1 }} aria-label="위로"><Svg size={13}><path d="m18 15-6-6-6 6" /></Svg></button>
                      <button onClick={() => move(i, 1)} disabled={i === added.length - 1} style={{ ...smallBtn, opacity: i === added.length - 1 ? 0.3 : 1 }} aria-label="아래로"><Svg size={13}><path d="m6 9 6 6 6-6" /></Svg></button>
                      <button onClick={() => remove(s.id)} style={{ ...smallBtn, color: 'var(--red)' }} aria-label="삭제"><Svg size={13}><path d="M6 6l12 12M18 6 6 18" /></Svg></button>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={() => setStep(1)} style={{ ...ghostBtn, marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 5 }}><Svg size={14}><path d="M12 5v14M5 12h14" /></Svg>샵 더 담기</button>
            </>
          )}

          {/* STEP 3 — 루트 정보 */}
          {step === 3 && (
            <>
              <StepHead icon={<Svg size={20} color="var(--accent)"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /></Svg>} title="루트 정보를 채워요" sub="제목은 직접 지어도 되고, 추천을 눌러 채워도 돼요." />
              <Label>루트 이름</Label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={50} placeholder="예: 홍대 원피스 굿즈 투어" style={{ ...inp, marginBottom: 8 }} />
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', marginBottom: 6 }}>추천 제목 <span style={{ fontWeight: 600 }}>· 클릭하면 입력돼요</span></div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {suggestions.map((sug) => (
                    <button key={sug} onClick={() => setTitle(sug)} style={{ padding: '7px 12px', borderRadius: 9999, border: '1px dashed var(--accent)', background: 'var(--surface)', color: 'var(--accent)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>{sug}</button>
                  ))}
                </div>
              </div>
              <Label>한 줄 소개</Label>
              <textarea value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={80} placeholder="이 루트를 한 줄로 소개해보세요! (선택)" style={{ ...inp, minHeight: 60, marginBottom: 16, resize: 'vertical' }} />
              <Label>대표 이미지</Label>
              <div style={{ height: 150, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', background: coverUrl ? 'transparent' : 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                {coverUrl ? <img src={coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: 'var(--muted)', fontSize: 13, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}><Svg size={26} color="var(--muted)"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></Svg>이미지를 업로드하세요</span>}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="이미지 URL 또는 업로드" style={{ ...inp, flex: 1 }} />
                <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ ...smallBtn, padding: '0 14px' }}>{uploading ? '업로드 중...' : '업로드'}</button>
                {coverUrl && <button onClick={() => setCoverUrl('')} style={{ ...smallBtn, color: 'var(--red)' }}>제거</button>}
              </div>
              <input ref={fileRef} type="file" accept="image/*" onChange={onPickFile} style={{ display: 'none' }} />
            </>
          )}

          {/* STEP 4 — 테마 & 추천 */}
          {step === 4 && (
            <>
              <StepHead icon={<Svg size={20} color="var(--accent)"><path d="M20.6 13.4 11 3.8a2 2 0 0 0-1.4-.6H4a1 1 0 0 0-1 1v5.6a2 2 0 0 0 .6 1.4l9.6 9.6a2 2 0 0 0 2.8 0l4.6-4.6a2 2 0 0 0 0-2.8Z" /><circle cx="7.5" cy="7.5" r="1" /></Svg>} title="테마와 추천을 정해요" sub="어떤 사람에게, 어떤 느낌의 루트인지 알려줘요." />
              <Label>테마 (여러 개 선택 가능)</Label>
              <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                {THEMES.map((t) => (
                  <button key={t} onClick={() => toggleTheme(t)} style={{ ...chip(themes.includes(t)), display: 'inline-flex', alignItems: 'center', gap: 5 }}><ThemeIcon name={t} size={14} color={themes.includes(t) ? '#fff' : 'currentColor'} />{t}</button>
                ))}
              </div>
              <Label>이런 분들에게 추천해요 (선택)</Label>
              <textarea value={target} onChange={(e) => setTarget(e.target.value)} placeholder={'- 원피스를 좋아하는 분\n- 사진 찍기 좋아하는 분'} style={{ ...inp, minHeight: 72, marginBottom: 16, resize: 'vertical', lineHeight: 1.6 }} />
              <Label>루트 TIP (선택)</Label>
              <textarea value={tips} onChange={(e) => setTips(e.target.value)} placeholder={'- 사람이 많으니 미리 가 있는 걸 추천드려요\n- 예: 카페는 웨이팅이 길 수 있어요'} style={{ ...inp, minHeight: 72, marginBottom: 16, resize: 'vertical', lineHeight: 1.6 }} />
              <Label>난이도</Label>
              <div style={{ display: 'flex', gap: 6 }}>
                {DIFF.map((d) => {
                  const on = difficulty === d.v
                  return (
                    <button key={d.v} onClick={() => setDifficulty(d.v)} style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 8px', borderRadius: 10, border: `1px solid ${on ? d.c : 'var(--border)'}`, background: on ? d.c : 'var(--surface)', color: on ? '#fff' : 'var(--text)', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                      <DiffIcon v={d.v} color={on ? '#fff' : d.c} />{d.l}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {/* STEP 5 — 확인 & 저장 */}
          {step === 5 && (
            <>
              <StepHead icon={<CheckIcon size={20} color="var(--accent)" />} title="마지막으로 확인해요" sub="오른쪽 미리보기를 보고 저장하면 끝이에요." />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                <ReviewRow label="루트 이름" value={title || '(미입력)'} ok={!!title.trim()} />
                <ReviewRow label="스팟" value={`${added.length}곳`} ok={added.length >= 2} />
                <ReviewRow label="난이도" value={diffMeta.l} ok />
                <ReviewRow label="테마" value={themes.length ? themes.join(', ') : '(없음)'} ok={themes.length > 0} />
                <ReviewRow label="대표 이미지" value={coverUrl ? '있음' : '없음'} ok={!!coverUrl} />
              </div>
              <button onClick={save} disabled={saving} style={{ width: '100%', padding: 16, borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 16, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit' }}>{saving ? '저장 중...' : (editing ? '변경사항 저장' : '루트 저장하기')}</button>
              {editing && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 14, padding: '12px 14px', background: 'var(--surface2)', borderRadius: 12 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800 }}>공개 설정</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{shared ? '누구나 볼 수 있어요' : '나만 볼 수 있어요 (작성중)'}</div>
                    </div>
                    <button onClick={toggleShared} disabled={shareBusy} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9999, border: 'none', background: shared ? 'var(--green)' : 'var(--yellow)', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>{shareBusy ? '처리 중…' : (shared ? '공개' : '작성중')}</button>
                  </div>
                  <button onClick={doDelete} style={{ width: '100%', marginTop: 12, padding: 13, borderRadius: 12, border: '1px solid var(--red)', background: 'var(--surface)', color: 'var(--red)', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Svg size={15} color="var(--red)"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" /></Svg>루트 삭제</button>
                </>
              )}
            </>
          )}

          {/* 미완료 안내 */}
          {msg && <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 7, background: '#FDECEC', border: '1px solid var(--red)', color: 'var(--red)', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 700 }}><Svg size={15} color="var(--red)"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></Svg>{msg}</div>}
          {/* 단계 이동 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <button onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1} style={{ ...ghostBtn, opacity: step === 1 ? 0.4 : 1, display: 'inline-flex', alignItems: 'center', gap: 5 }}><Svg size={15}><path d="m15 18-6-6 6-6" /></Svg>이전</button>
            {step < 5 ? (
              <button onClick={() => { if (canNext) { setStep((s) => Math.min(5, s + 1)); setMsg(null) } else { setMsg(curIssue) } }} style={{ padding: '13px 26px', borderRadius: 10, border: 'none', background: canNext ? 'var(--accent)' : 'var(--border)', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5 }}>다음 단계<Svg size={15} color="#fff"><path d="m9 18 6-6-6-6" /></Svg></button>
            ) : <span />}
          </div>
        </div>

      </div>

      {/* 하단 배너 */}
      <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', background: 'var(--accent-l, #FFE6EF)', borderRadius: 16, padding: '16px 20px' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--accent)' }}>어렵지 않아요! 5단계만 따라하면 루트 완성</div>
          <div style={{ fontSize: 13, color: 'var(--text)', marginTop: 2 }}>왼쪽에서 순서대로 채우면 완성돼요.</div>
        </div>
      </div>

    </div>
  )
}

/* ---- 작은 컴포넌트/스타일 ---- */
function StepHead({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
      <span style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: 'var(--accent-l, #FFE6EF)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</span>
      <div>
        <div style={{ fontSize: 16, fontWeight: 900 }}>{title}</div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>
      </div>
    </div>
  )
}
function ReviewRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'var(--surface2)' }}>
      <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)' }}>{label}</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: ok ? 'var(--text)' : 'var(--red)', minWidth: 0 }}>
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>{value}</span>
        {ok ? <CheckIcon size={14} color="var(--green)" /> : null}
      </span>
    </div>
  )
}
const inp: React.CSSProperties = { width: '100%', padding: '11px 12px', borderRadius: 10, border: '1px solid var(--border)', fontFamily: 'inherit', fontSize: 14, background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box' }
const smallBtn: React.CSSProperties = { padding: '7px 11px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }
const ghostBtn: React.CSSProperties = { padding: '9px 15px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }
const iconBtn: React.CSSProperties = { width: 36, height: 36, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }
function modeBtn(active: boolean): React.CSSProperties {
  return { flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, background: active ? 'var(--accent)' : 'var(--surface)', color: active ? '#fff' : 'var(--text)', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }
}
function chip(active: boolean): React.CSSProperties {
  return { padding: '8px 14px', borderRadius: 9999, border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, background: active ? 'var(--accent)' : 'var(--surface)', color: active ? '#fff' : 'var(--text)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }
}
function Label({ children }: { children: React.ReactNode }) { return <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', marginBottom: 6 }}>{children}</div> }
