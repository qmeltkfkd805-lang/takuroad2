'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useAuth } from '@/components/layout/AuthProvider'
import { getAllTagsFull, AdminTag } from '@/services/workAdminService'
import { getShops, getSavedShops } from '@/services/shopService'
import { createRoute, updateRouteMeta, updateRoute, getRouteForEdit, getRouteMeta, deleteRoute, toggleRouteShare } from '@/services/routeService'
import { useRouter } from 'next/navigation'
import { shopRegion } from '@/lib/shop/quickCompleteness'
import { Shop } from '@/types/shop'
import RouteMiniMap from '@/components/admin/RouteMiniMap'

const DIFF = [
  { v: 1, l: '가볍게', c: '#0E7A63' },
  { v: 2, l: '반나절', c: '#835700' },
  { v: 3, l: '하루 코스', c: '#A23E18' },
]
const THEMES = ['카페', '굿즈', '사진명소', '가족', '커플', '혼자', '실내', '비오는날', '친구', '가챠', '쿠지', '전시', '팝업', '게임', '만화카페']
const STEPS = [
  { n: 1, label: '이름 & 샵' },
  { n: 2, label: '코스 담기' },
  { n: 3, label: '대표 작품' },
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
  const [sourceMode, setSourceMode] = useState<SourceMode>('region')  // 샵 소스: 샵 검색(region) / 저장한 샵(saved)
  const [tags, setTags] = useState<AdminTag[]>([])
  const [tagQuery, setTagQuery] = useState('')
  const [selectedTag, setSelectedTag] = useState<AdminTag | null>(null)
  const [candidates, setCandidates] = useState<Shop[]>([])
  const [loadingShops, setLoadingShops] = useState(false)
  const [query, setQuery] = useState('')
  const [added, setAdded] = useState<Shop[]>([])
  const [moveTips, setMoveTips] = useState<Record<string, string>>({})   // fromShopId → 다음 스팟까지 이동 팁

  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [difficulty, setDifficulty] = useState(1)
  const [coverUrl, setCoverUrl] = useState('')
  const [themes, setThemes] = useState<string[]>([])
  const [target, setTarget] = useState('')
  const [tips, setTips] = useState('')
  const [primaryTagId, setPrimaryTagId] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)
  const editing = mode === 'edit'
  const [shared, setShared] = useState(initialShared)
  const [loadingEdit, setLoadingEdit] = useState(mode === 'edit')
  const [shareBusy, setShareBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [showExit, setShowExit] = useState(false)   // 나가기 확인 다이얼로그
  const [publishAsk, setPublishAsk] = useState<{ id: string; shareToken: string } | null>(null) // 저장 직후 공개 여부 묻기
  const [publishBusy, setPublishBusy] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)  // '좋은 루트 만드는 법' 접기/펼치기

  useEffect(() => { getAllTagsFull().then(setTags).catch(() => {}) }, [])

  // 편집 모드: 기존 데이터 불러오기
  useEffect(() => {
    if (mode !== 'edit' || !editRouteId) return
    let alive = true
    getRouteForEdit(editRouteId).then((r: any) => {
      if (!alive) return
      if (r) {
        setTitle(r.title ?? ''); setDesc(r.description ?? ''); setDifficulty(r.official_difficulty ?? 1)
        const ordered = (r.route_shops ?? []).slice().sort((a: any, b: any) => a.sort_order - b.sort_order)
        const shops = ordered.map((rs: any) => rs.shops).filter((s: any) => s && s.lat != null && s.lng != null)
        setAdded(shops as Shop[])
        const tips: Record<string, string> = {}
        ordered.forEach((rs: any) => { if (rs.shops?.id && rs.move_tip) tips[rs.shops.id] = rs.move_tip })
        setMoveTips(tips)
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

  // 작품 선택 — 루트의 대표 작품만 지정 (샵 후보는 건드리지 않음: 샵은 검색/저장한 샵에서 담는다)
  function pickTag(t: AdminTag) {
    setSelectedTag(t); setTagQuery(''); setPrimaryTagId(t.id)
  }

  function toggleTheme(t: string) { setThemes((a) => a.includes(t) ? a.filter((x) => x !== t) : [...a, t]) }

  // 띄어쓰기·대소문자 무시 검색용 정규화
  const norm = (s: string) => (s ?? '').toLowerCase().replace(/\s+/g, '')
  const q = norm(query)
  const filtered = useMemo(() => {
    if (!q) return candidates
    return candidates.filter((s) => norm(s.name ?? '').includes(q) || norm(s.addr ?? '').includes(q) || norm(shopRegion(s)).includes(q))
  }, [candidates, q])
  const addedIds = useMemo(() => new Set(added.map((s) => s.id)), [added])

  function add(s: Shop) { if (!addedIds.has(s.id)) setAdded((a) => [...a, s]) }
  function addAll() { setAdded((a) => { const ids = new Set(a.map((x) => x.id)); return [...a, ...filtered.filter((s) => !ids.has(s.id))] }) }
  function remove(id: string) { setAdded((a) => a.filter((s) => s.id !== id)) }
  function move(i: number, dir: -1 | 1) {
    setAdded((a) => { const j = i + dir; if (j < 0 || j >= a.length) return a; const c = [...a]; [c[i], c[j]] = [c[j], c[i]]; return c })
  }
  // ── 꾹 눌러서 순서 바꾸기 (터치·마우스 공통) — 드래그 행이 손가락을 따라오고 나머지는 자리를 비켜줌 ──
  const rowRefs = useRef<(HTMLElement | null)[]>([])
  const listRef = useRef<HTMLDivElement | null>(null)
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastYRef = useRef(0)
  const grabRef = useRef(0)   // 행 안에서 잡은 지점(오프셋)
  const hRef = useRef(52)      // 행 높이
  // 실시간 재정렬: 드래그하는 동안 added 순서가 바로 바뀌고, 잡은 행만 손가락을 따라 떠 있게 한다
  const [drag, setDrag] = useState<{ id: string; index: number; dy: number } | null>(null)

  const startDrag = (e: React.PointerEvent, i: number) => {
    lastYRef.current = e.clientY
    const downY = e.clientY
    if (pressTimer.current) clearTimeout(pressTimer.current)
    // 누른 채로 살짝 움직이면 스크롤로 보고 롱프레스 취소
    const preMove = (ev: PointerEvent) => { lastYRef.current = ev.clientY; if (Math.abs(ev.clientY - downY) > 12) cancel() }
    const cancel = () => {
      if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null }
      window.removeEventListener('pointermove', preMove); window.removeEventListener('pointerup', cancel); window.removeEventListener('pointercancel', cancel)
    }
    window.addEventListener('pointermove', preMove)
    window.addEventListener('pointerup', cancel)
    window.addEventListener('pointercancel', cancel)
    pressTimer.current = setTimeout(() => {
      window.removeEventListener('pointermove', preMove)
      const el = rowRefs.current[i]
      const rect = el?.getBoundingClientRect()
      hRef.current = rect ? rect.height : 52
      // 잡은 지점이 행 안 어디인지 실제 위치로 측정 (누르는 동안의 미세한 흔들림·스크롤에 영향받지 않게)
      grabRef.current = rect ? lastYRef.current - rect.top : hRef.current / 2
      setDrag({ id: added[i].id, index: i, dy: 0 })
      try { (navigator as any).vibrate?.(12) } catch { /* noop */ }
    }, 180)
  }

  useEffect(() => {
    if (!drag) return
    const dragId = drag.id
    const onMove = (e: PointerEvent) => {
      e.preventDefault()
      const y = e.clientY
      const listTop = listRef.current?.getBoundingClientRect().top ?? 0
      const h = hRef.current
      // 잡은 행의 실제 top이 놓인 슬롯
      const raw = Math.max(0, Math.min(added.length - 1, Math.round((y - grabRef.current - listTop) / h)))
      // 실시간으로 순서 반영 → 화면에 보이는 그대로가 결과가 된다
      setAdded((a) => {
        const idx = a.findIndex((x) => x.id === dragId)
        if (idx === -1 || idx === raw) return a
        const c = [...a]; const [m] = c.splice(idx, 1); c.splice(raw, 0, m); return c
      })
      // 잡은 행만 손가락을 따라 떠 있게 오프셋 갱신
      setDrag((d) => d ? { ...d, index: raw, dy: (y - grabRef.current) - (listTop + raw * h) } : d)
    }
    const onUp = () => setDrag(null)
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onUp) }
  }, [drag, added.length])

  const tagMatches = tagQuery.trim() ? tags.filter((t) => norm(t.name).includes(norm(tagQuery))).slice(0, 8) : []
  const mapStops = useMemo(() => added.map((s) => ({ id: s.id, lat: s.lat as number, lng: s.lng as number, name: s.name })), [added])
  const showCandidates = true   // 샵 후보 목록은 항상 표시 (샵 검색 / 저장한 샵)

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
    { label: '스팟 2곳 이상 담기', ok: added.length >= 2 },
    { label: '테마·추천 대상 설정', ok: themes.length > 0 || !!target.trim() },
  ]

  async function save() {
    if (!user) return
    if (!title.trim()) { setMsg('루트 이름을 입력하세요'); setStep(1); return }
    if (added.length < 2) { setMsg('샵을 2개 이상 담아주세요'); setStep(2); return }
    setSaving(true); setMsg(null)
    const shopInput = added.map((s, i) => ({ shopId: s.id, lat: s.lat as number, lng: s.lng as number, moveTip: i < added.length - 1 ? (moveTips[s.id] ?? null) : null }))
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
    // 저장 완료 → 공개 여부를 물어본 뒤 '내 루트'로 이동
    setPublishAsk({ id: res.id, shareToken: res.shareToken })
  }

  // 저장 직후 공개/비공개 선택 → 내 루트 화면으로
  async function finishPublish(makePublic: boolean) {
    if (!user || !publishAsk || publishBusy) return
    setPublishBusy(true)
    if (makePublic) {
      await toggleRouteShare(publishAsk.id, user.id, true)
    }
    router.push('/profile?tab=routes')
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
    if (n === 1) {
      if (!title.trim()) return '루트 이름을 입력해주세요'
      return added.length >= 2 ? null : '샵을 2곳 이상 담아주세요'
    }
    if (n === 2) return added.length >= 2 ? null : '샵을 2곳 이상 담아야 루트가 돼요'
    if (n === 3) return null
    if (n === 4) return themes.length >= 1 ? null : '테마를 1개 이상 선택해주세요'
    return null
  }
  const curIssue = stepIssue(step)
  const canNext = curIssue === null

  // 나가기 — 작성 내용이 있으면 확인
  const hasContent = added.length > 0 || !!title.trim() || !!coverUrl || themes.length > 0 || !!desc.trim() || !!target.trim() || !!tips.trim()
  const requestExit = () => { if (hasContent && !editing) setShowExit(true); else router.push('/routes') }
  const doExit = () => { setShowExit(false); router.push('/routes') }
  const cur = STEPS.find(s => s.n === step)!
  const upcoming = STEPS.filter(s => s.n > step)
  const progressPct = Math.round((step / STEPS.length) * 100)
  // 하단 다음 버튼 라벨
  const nextLabel = step === 1
    ? (added.length >= 2 ? `선택한 샵 ${added.length}개로 다음 단계` : (added.length === 1 ? '샵을 1곳 더 담아주세요' : '샵을 담아주세요'))
    : '다음 단계'

  return (
    <div className="rb-root" style={{ maxWidth: 1320, margin: '0 auto', padding: '20px 32px' }}>
      <style>{`
        .rb-root{ width:100%; max-width:100%; overflow-x:hidden; }
        .rb-bottom{ position:sticky; bottom:0; }
        @media (hover:none) and (pointer:coarse){
          .rb-root{ padding:12px 14px 96px !important; }
          .rb-form{ padding:16px 16px !important; border-radius:14px !important; border-left:none !important; border-right:none !important; margin:0 -14px !important; }
          .rb-bottom{ position:fixed !important; left:0; right:0; bottom:0; }
        }
      `}</style>
      {/* 전용 헤더 — 뒤로 · 루트 만들기 · 나가기 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={requestExit} style={iconBtn} aria-label="뒤로"><Svg><path d="m15 18-6-6 6-6" /></Svg></button>
        <h1 style={{ flex: 1, fontSize: 20, fontWeight: 900, margin: 0 }}>{editing ? '루트 수정' : '루트 만들기'}</h1>
        <button onClick={requestExit} style={ghostBtn}>나가기</button>
      </div>

      {/* 스텝 표시 — N/전체 · 단계명 · 진행 바 · 다음 단계 보조 텍스트 */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 900, color: 'var(--accent)' }}>{step} / {STEPS.length}</span>
          <span style={{ fontSize: 18, fontWeight: 900 }}>{cur.label}</span>
        </div>
        <div style={{ height: 8, borderRadius: 9999, background: 'var(--surface2)', overflow: 'hidden' }}>
          <div style={{ width: `${progressPct}%`, height: '100%', background: 'var(--accent)', borderRadius: 9999, transition: 'width .25s' }} />
        </div>
        {upcoming.length > 0 && (
          <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 }}>
            다음: {upcoming.map(s => s.label).join(' · ')}
          </div>
        )}
      </div>

      {/* 본문 */}
      <div>
        <div className="rb-form" style={{ border: '1px solid var(--border)', borderRadius: 18, padding: 32, background: 'var(--surface)' }}>
          {/* STEP 1 — 샵 불러오기 */}
          {step === 1 && (
            <>
              <StepHead icon={<Svg size={20} color="var(--accent)"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /></Svg>} title="루트 이름을 정해요" sub="루트 이름을 정하고, 샵을 골라 담아요." />

              {/* 루트 이름 — 직접 입력하거나 추천을 눌러 채우기 */}
              <Label>루트 이름</Label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={50} placeholder="예: 홍대 원피스 굿즈 투어" style={{ ...inp, marginBottom: 8 }} />
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', marginBottom: 6 }}>추천 제목 <span style={{ fontWeight: 600 }}>· 클릭하면 입력돼요</span></div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {suggestions.map((sug) => (
                    <button key={sug} onClick={() => setTitle(sug)} style={{ padding: '7px 12px', borderRadius: 9999, border: '1px dashed var(--accent)', background: 'var(--surface)', color: 'var(--accent)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>{sug}</button>
                  ))}
                </div>
              </div>

              {/* 한 줄 소개 */}
              <Label>한 줄 소개</Label>
              <textarea value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={80} placeholder="이 루트를 한 줄로 소개해보세요! (선택)" style={{ ...inp, minHeight: 60, marginBottom: 18, resize: 'vertical' }} />

              {/* 샵 불러오기 — 샵 검색 / 저장한 샵 */}
              <Label>샵 불러오기</Label>
              <div style={{ display: 'flex', gap: 4, marginBottom: 16, padding: 4, background: 'var(--surface2)', borderRadius: 12 }}>
                <button onClick={() => switchMode('region')} style={modeBtn(sourceMode === 'region')}>샵 검색</button>
                <button onClick={() => switchMode('saved')} style={modeBtn(sourceMode === 'saved')}>저장한 샵</button>
              </div>

              {showCandidates && (
                <>
                  <Label>{sourceMode === 'saved' ? '저장한 샵' : '샵 검색'}</Label>
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={searchPlaceholder} style={{ ...inp, marginBottom: 10 }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>{loadingShops ? '불러오는 중...' : `${filtered.length}개 샵 · 담김 ${added.length}`}</span>
                    {filtered.length > 0 && <button onClick={addAll} style={smallBtn}>전체 담기</button>}
                  </div>
                  <div style={{ height: 300, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
                    {filtered.map((s) => (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{shopRegion(s)}</div>
                        </div>
                        <button onClick={() => addedIds.has(s.id) ? remove(s.id) : add(s)} style={{ ...smallBtn, ...(addedIds.has(s.id) ? { background: 'var(--surface)', color: 'var(--accent)', border: '1px solid var(--accent)' } : {}) }}>{addedIds.has(s.id) ? '✓ 담김' : '담기'}</button>
                      </div>
                    ))}
                    {!loadingShops && filtered.length === 0 && <div style={{ padding: 16, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>{sourceMode === 'saved' ? '저장한 샵이 없어요' : '검색 결과가 없어요'}</div>}
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
              <Label>루트 순서 ({added.length}) · 꾹 눌러 이동</Label>
              {added.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 13, border: '1px dashed var(--border)', borderRadius: 10 }}>1단계에서 샵을 담아주세요</div>
              ) : (
                <div ref={listRef} style={{ touchAction: drag ? 'none' : undefined }}>
                  {added.map((s, i) => {
                    const dragging = drag?.id === s.id
                    const transform = dragging ? `translateY(${drag!.dy}px)` : undefined
                    return (
                    <div key={s.id} ref={(el) => { rowRefs.current[i] = el }}
                      onPointerDown={(e) => startDrag(e, i)}
                      draggable={false} onDragStart={(e) => e.preventDefault()}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 4px', borderBottom: '1px solid var(--border)', background: dragging ? 'var(--accent-l, #FFE6EF)' : 'var(--surface)', boxShadow: dragging ? '0 6px 18px rgba(0,0,0,.16)' : 'none', borderRadius: dragging ? 10 : 0, position: 'relative', zIndex: dragging ? 20 : 1, transform, transition: dragging ? 'none' : 'transform .15s', cursor: 'grab', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}>
                      <span style={{ width: 22, height: 22, borderRadius: 9999, background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span>
                      <button onPointerDown={(e) => e.stopPropagation()} onClick={() => move(i, -1)} disabled={i === 0} style={{ ...smallBtn, opacity: i === 0 ? 0.3 : 1 }} aria-label="위로"><Svg size={13}><path d="m18 15-6-6-6 6" /></Svg></button>
                      <button onPointerDown={(e) => e.stopPropagation()} onClick={() => move(i, 1)} disabled={i === added.length - 1} style={{ ...smallBtn, opacity: i === added.length - 1 ? 0.3 : 1 }} aria-label="아래로"><Svg size={13}><path d="m6 9 6 6 6-6" /></Svg></button>
                      <button onPointerDown={(e) => e.stopPropagation()} onClick={() => remove(s.id)} style={{ ...smallBtn, color: 'var(--red)' }} aria-label="삭제"><Svg size={13}><path d="M6 6l12 12M18 6 6 18" /></Svg></button>
                    </div>
                    )
                  })}
                </div>
              )}
              {added.length >= 2 && (
                <div style={{ marginTop: 20 }}>
                  <Label>구간 이동 팁 (선택)</Label>
                  <div style={{ fontSize: 12, color: 'var(--muted)', margin: '2px 0 10px' }}>스팟 사이 이동에 대한 팁을 남겨보세요. 예: 지하상가로 가면 더 빨라요</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {added.slice(0, -1).map((s, i) => (
                      <div key={s.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{i + 1} {s.name} → {i + 2} {added[i + 1].name}</div>
                        <input value={moveTips[s.id] ?? ''} onChange={(e) => setMoveTips(prev => ({ ...prev, [s.id]: e.target.value }))} maxLength={100} placeholder="이동 팁 (예: 4번 출구로 나가 지하상가 경유)" style={{ ...inp, marginBottom: 0 }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <button onClick={() => setStep(1)} style={{ ...ghostBtn, marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 5 }}><Svg size={14}><path d="M12 5v14M5 12h14" /></Svg>샵 더 담기</button>
            </>
          )}

          {/* STEP 3 — 루트 정보 */}
          {step === 3 && (
            <>
              <StepHead icon={<Svg size={20} color="var(--accent)"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /></Svg>} title="대표 작품을 골라요" sub="이 루트를 대표하는 작품을 지정해요. (선택)" />

              {/* 작품 선택 — 루트의 대표 작품을 지정 (선택) */}
              <Label>작품 선택 <span style={{ fontWeight: 600, color: 'var(--muted)' }}>· 선택</span></Label>
              {selectedTag ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 800 }}><MaskIcon name="star" size={15} color="var(--accent)" />{selectedTag.name}</span>
                  <button onClick={() => { setSelectedTag(null); setPrimaryTagId(null) }} style={smallBtn}>변경</button>
                </div>
              ) : (
                <div style={{ position: 'relative', marginBottom: 18 }}>
                  <input value={tagQuery} onChange={(e) => setTagQuery(e.target.value)} placeholder="작품 이름 검색" style={inp} />
                  {tagMatches.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, marginTop: 4, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,.12)' }}>
                      {tagMatches.map((t) => (
                        <button key={t.id} onClick={() => pickTag(t)} style={{ display: 'block', width: '100%', textAlign: 'left', minHeight: 44, padding: '10px 12px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, color: 'var(--text)' }}>{t.name}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}
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
              </div>
              {/* 저장 버튼은 하단 고정 액션 바에 있음 */}
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
          {/* 좋은 루트 만드는 법 — 접이식 한 줄 */}
          <div style={{ marginTop: 20, border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <button onClick={() => setGuideOpen((o) => !o)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', minHeight: 48, padding: '0 14px', border: 'none', background: 'var(--surface)', cursor: 'pointer', fontFamily: 'inherit' }}>
              <MaskIcon name="star" size={16} color="var(--accent)" />
              <span style={{ flex: 1, textAlign: 'left', fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>좋은 루트 만드는 법</span>
              <Svg size={16} style={{ transform: guideOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}><path d="m6 9 6 6 6-6" /></Svg>
            </button>
            {guideOpen && (
              <div style={{ padding: '4px 14px 14px', display: 'flex', flexDirection: 'column', gap: 9, borderTop: '1px solid var(--border)' }}>
                {guide.map((g) => (
                  <div key={g.label} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13.5, color: g.ok ? 'var(--text)' : 'var(--muted)' }}>
                    <span style={{ width: 18, height: 18, borderRadius: 9999, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: g.ok ? 'var(--accent)' : 'var(--surface2)' }}>{g.ok ? <CheckIcon size={12} color="#fff" /> : <span style={{ width: 5, height: 5, borderRadius: 9999, background: 'var(--muted)' }} />}</span>
                    {g.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 하단 고정 액션 바 */}
      <div className="rb-bottom" style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)', padding: '10px 14px calc(10px + env(safe-area-inset-bottom))', marginTop: 20, display: 'flex', gap: 10, zIndex: 30 }}>
        {step > 1 && (
          <button onClick={() => setStep((s) => Math.max(1, s - 1))} style={{ ...ghostBtn, minHeight: 50, flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '0 18px' }}><Svg size={15}><path d="m15 18-6-6 6-6" /></Svg>이전</button>
        )}
        {step < STEPS.length ? (
          <button onClick={() => { if (canNext) { setStep((s) => Math.min(STEPS.length, s + 1)); setMsg(null) } else { setMsg(curIssue) } }} disabled={!canNext} style={{ flex: 1, minWidth: 0, minHeight: 50, borderRadius: 12, border: 'none', background: canNext ? 'var(--accent)' : 'var(--border)', color: '#fff', fontWeight: 800, fontSize: 15, cursor: canNext ? 'pointer' : 'default', fontFamily: 'inherit', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{canNext ? nextLabel : (curIssue ?? nextLabel)}</button>
        ) : (
          <button onClick={save} disabled={saving} style={{ flex: 1, minWidth: 0, minHeight: 50, borderRadius: 12, border: 'none', background: saving ? 'var(--border)' : 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 15, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit' }}>{saving ? '저장 중…' : (editing ? '변경사항 저장' : '루트 저장하기')}</button>
        )}
      </div>

      {/* 나가기 확인 다이얼로그 */}
      {showExit && (
        <div onClick={() => setShowExit(false)} style={{ position: 'fixed', inset: 0, zIndex: 4000, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 340, background: 'var(--surface)', borderRadius: 18, padding: '22px 20px 18px' }}>
            <div style={{ fontSize: 17, fontWeight: 900, marginBottom: 8 }}>루트 만들기를 종료할까요?</div>
            <div style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 18 }}>작성 중인 내용이 저장되지 않을 수 있어요.</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowExit(false)} style={{ flex: 1, minHeight: 48, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 800, fontSize: 14.5, cursor: 'pointer', fontFamily: 'inherit' }}>계속 작성</button>
              <button onClick={doExit} style={{ flex: 1, minHeight: 48, borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 14.5, cursor: 'pointer', fontFamily: 'inherit' }}>나가기</button>
            </div>
          </div>
        </div>
      )}

      {/* 저장 완료 — 전체 공개 여부 확인 */}
      {publishAsk && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 4000, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ width: '100%', maxWidth: 360, background: 'var(--surface)', borderRadius: 18, padding: '24px 20px 18px', textAlign: 'center' }}>
            <div style={{ width: 52, height: 52, borderRadius: 9999, background: 'var(--accent-l, #FFE6EF)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <Svg size={26} color="var(--accent)"><path d="M20 6 9 17l-5-5" /></Svg>
            </div>
            <div style={{ fontSize: 17, fontWeight: 900, marginBottom: 8 }}>루트를 저장했어요!</div>
            <div style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 20 }}>이 루트를 전체보기에 공개할까요?<br />공개하면 다른 사람도 둘러볼 수 있어요.<br />나중에 내 루트에서 언제든 바꿀 수 있어요.</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => finishPublish(false)} disabled={publishBusy} style={{ flex: 1, minHeight: 48, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 800, fontSize: 14.5, cursor: publishBusy ? 'default' : 'pointer', fontFamily: 'inherit' }}>비공개로 저장</button>
              <button onClick={() => finishPublish(true)} disabled={publishBusy} style={{ flex: 1, minHeight: 48, borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 14.5, cursor: publishBusy ? 'default' : 'pointer', fontFamily: 'inherit' }}>{publishBusy ? '처리 중…' : '네, 공개할게요'}</button>
            </div>
          </div>
        </div>
      )}

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
  return { flex: 1, minWidth: 0, minHeight: 44, padding: '10px 6px', borderRadius: 9, border: 'none', background: active ? 'var(--accent)' : 'transparent', color: active ? '#fff' : 'var(--muted)', fontWeight: 800, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', boxShadow: active ? '0 1px 3px rgba(0,0,0,.12)' : 'none' }
}
function chip(active: boolean): React.CSSProperties {
  return { padding: '8px 14px', borderRadius: 9999, border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, background: active ? 'var(--accent)' : 'var(--surface)', color: active ? '#fff' : 'var(--text)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }
}
function Label({ children }: { children: React.ReactNode }) { return <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', marginBottom: 6 }}>{children}</div> }
