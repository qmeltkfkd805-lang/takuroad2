'use client'
import { useState, useEffect, useMemo, useRef, Fragment } from 'react'
import { useAuth } from '@/components/layout/AuthProvider'
import { getAllTagsFull, AdminTag } from '@/services/workAdminService'
import { getShops, getSavedShops } from '@/services/shopService'
import { autoOrder, floorNumber, floorGroupKey, floorGroupLabel, hasFloorGroups, type AutoOrderMode } from '@/lib/route/autoOrder'
import { createRoute, updateRouteMeta, updateRoute, getRouteForEdit, getRouteMeta, deleteRoute, toggleRouteShare, getRouteFloorMaps, saveRouteFloorMaps, uploadFloorMap, getRouteSources, saveRouteSources, type FloorMap, type RouteSource } from '@/services/routeService'
import { useRouter } from 'next/navigation'
import { shopRegion } from '@/lib/shop/quickCompleteness'
import { Shop } from '@/types/shop'
import RouteMiniMap from '@/components/admin/RouteMiniMap'
import LogoLoader from '@/components/common/LogoLoader'
import { useFormDraft } from '@/hooks/useFormDraft'
import DraftNotice from '@/components/common/DraftNotice'

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

export default function RouteBuilder({ mode = 'create', editRouteId = null, editToken = null, ownerId = null, initialShared = false, isOfficial = false, lastEdited = null }: { mode?: 'create' | 'edit'; editRouteId?: string | null; editToken?: string | null; ownerId?: string | null; initialShared?: boolean; isOfficial?: boolean; lastEdited?: string | null } = {}) {
  const router = useRouter()
  const { user, isAdmin } = useAuth()

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
  // 순서 자동 정하기 (층별 안내 / 도보 안내 / 둘 다) — 누르기 전 순서를 기억해 되돌릴 수 있게
  const [orderMode, setOrderMode] = useState<AutoOrderMode | null>(null)
  const [orderBefore, setOrderBefore] = useState<Shop[] | null>(null)
  const autoResultRef = useRef<Shop[] | null>(null)
  const [orderNote, setOrderNote] = useState<string | null>(null)
  const [tipsOpen, setTipsOpen] = useState(false)   // 구간 이동 팁 — 평소엔 접어 두고 펼치면 입력
  // 층 지도 — 루트 순서의 층별 묶음(같은 건물·같은 층)마다 참고용 이미지 1장 (키 = floorGroupKey)
  const showFloorGroups = hasFloorGroups(added as any)
  const [floorMaps, setFloorMaps] = useState<Record<string, FloorMap>>({})
  const [floorMapBusy, setFloorMapBusy] = useState<string | null>(null)
  const floorMapInput = useRef<HTMLInputElement>(null)
  const floorMapTarget = useRef<{ key: string; label: string } | null>(null)
  function pickFloorMap(key: string, label: string) { floorMapTarget.current = { key, label }; floorMapInput.current?.click() }
  async function onFloorMapFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = ''
    const t = floorMapTarget.current
    if (!file || !t || !user || !file.type.startsWith('image/')) return
    setFloorMapBusy(t.key)
    const url = await uploadFloorMap(user.id, file).catch(() => null)
    setFloorMapBusy(null)
    if (!url) { setMsg('층 지도 이미지를 올리지 못했어요. 잠시 후 다시 시도해 주세요.'); return }
    setFloorMaps(prev => ({ ...prev, [t.key]: { ...(prev[t.key] ?? {}), key: t.key, label: t.label, url } }))   // 사진만 바꿔도 적어 둔 출처는 유지
  }
  /** 저장할 층 지도 — 지금 루트에 있는 묶음 것만, 제목은 최신으로. 출처 링크는 http(s) 만 */
  function floorMapsToSave(): FloorMap[] {
    const labels = new Map(added.map(s => [floorGroupKey(s as any), floorGroupLabel(s as any)]))
    return Object.values(floorMaps).filter(m => labels.has(m.key)).map(m => {
      const link = (m.sourceUrl ?? '').trim()
      return { ...m, label: labels.get(m.key)!, sourceName: (m.sourceName ?? '').trim() || null, sourceUrl: link ? (/^https?:\/\//i.test(link) ? link : `https://${link}`) : null }
    })
  }
  // 루트 출처 — 다른 분의 인스타·블로그 코스를 참고했다면 (루트 소개에 링크로 표시)
  const [sources, setSources] = useState<{ name: string; url: string }[]>([])
  function sourcesToSave(): RouteSource[] {
    return sources.map(x => {
      const link = x.url.trim()
      return { name: x.name.trim(), url: link ? (/^https?:\/\//i.test(link) ? link : `https://${link}`) : null }
    }).filter(x => x.name || x.url)
  }
  // 자동 정렬 뒤 직접 옮기거나 샵을 더하고 빼면 → 그 순서가 새 기준 (되돌리기 대상 없음)
  useEffect(() => {
    if (autoResultRef.current && added !== autoResultRef.current) { autoResultRef.current = null; setOrderBefore(null); setOrderMode(null); setOrderNote(null) }
  }, [added])
  function applyAutoOrder(m: AutoOrderMode) {
    const base = orderBefore ?? added
    const next = autoOrder(base, m)
    autoResultRef.current = next
    setOrderBefore(base); setAdded(next); setOrderMode(m)
    // 바뀐 게 없으면 왜 그런지 알려준다 (층 정보가 없거나 이미 그 순서)
    const same = next.every((s, i) => s.id === added[i]?.id)
    const noFloor = base.filter(s => floorNumber(s as any) === null).length
    if (same) setOrderNote(m !== 'walk' && noFloor > 0 ? `층 정보가 없는 샵이 ${noFloor}곳 있어 층 순서를 정하지 못한 곳이 있어요. 지금이 이미 그 순서예요.` : '지금이 이미 그 순서예요.')
    else setOrderNote(m !== 'walk' && noFloor > 0 ? `층 정보가 없는 ${noFloor}곳은 같은 건물 맨 뒤에 뒀어요.` : null)
  }

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
  const isOwner = !!ownerId && !!user && user.id === ownerId
  const [shared, setShared] = useState(initialShared)
  const [loadingEdit, setLoadingEdit] = useState(mode === 'edit')
  const [editReady, setEditReady] = useState(mode !== 'edit')   // 수정 모드: 루트·출처·층 지도·메타를 다 불러온 뒤에야 임시저장본을 덮어쓴다
  const [msg, setMsg] = useState<string | null>(null)
  const [showExit, setShowExit] = useState(false)   // 나가기 확인 다이얼로그
  const [guideOpen, setGuideOpen] = useState(false)  // '좋은 루트 만드는 법' 접기/펼치기

  useEffect(() => { getAllTagsFull().then(setTags).catch(() => {}) }, [])

  // 편집 모드: 기존 데이터 불러오기
  useEffect(() => {
    if (mode !== 'edit' || !editRouteId) return
    let alive = true
    const loads: Promise<unknown>[] = []
    loads.push(getRouteForEdit(editRouteId).then((r: any) => {
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
    }).catch(() => setLoadingEdit(false)))
    loads.push(getRouteSources(editRouteId).then(list => { if (alive) setSources(list.map(x => ({ name: x.name, url: x.url ?? '' }))) }).catch(() => {}))
    loads.push(getRouteFloorMaps(editRouteId).then(list => { if (alive) setFloorMaps(Object.fromEntries(list.map(m => [m.key, m]))) }).catch(() => {}))
    loads.push(getRouteMeta(editRouteId).then((m: any) => {
      if (!alive) return
      setCoverUrl(m.cover ?? ''); setThemes(m.themes ?? [])
      setTarget(m.target ? String(m.target).split('\n').map((l: string) => '- ' + l).join('\n') : '')
      setTips(m.tips ? String(m.tips).split('\n').map((l: string) => '- ' + l).join('\n') : '')
      setPrimaryTagId(m.primaryTag ?? null)
    }).catch(() => {}))
    Promise.allSettled(loads).then(() => { if (alive) setEditReady(true) })
    return () => { alive = false }
  }, [mode, editRouteId])

  /* 작성 중 자동 임시저장 — 샵 정보 고치러 다른 화면에 다녀오거나 새로고침해도 담은 샵·순서·층 지도·출처·입력한 내용이 그대로.
     새 루트는 사용자별 1개, 수정은 루트별로. 저장(공개·임시 저장)하면 지운다. */
  type BuilderDraft = {
    step: number; added: Shop[]; moveTips: Record<string, string>; title: string; desc: string; difficulty: number
    coverUrl: string; themes: string[]; target: string; tips: string; primaryTagId: string | null; selectedTag: AdminTag | null
    floorMaps: Record<string, FloorMap>; sources: { name: string; url: string }[]; orderMode: AutoOrderMode | null
  }
  // 수정 모드: 불러온 그대로면 저장하지 않는다(바꾼 게 있을 때만 임시저장) — 단계 이동은 변경으로 치지 않음
  const draftData = { step, added, moveTips, title, desc, difficulty, coverUrl, themes, target, tips, primaryTagId, selectedTag, floorMaps, sources, orderMode }
  const sig = (d: BuilderDraft) => JSON.stringify({ ...d, step: 0, added: d.added.map(x => x.id) })
  const baselineRef = useRef<string | null>(null)
  if (editing && editReady && baselineRef.current === null) baselineRef.current = sig(draftData)
  const draftKey = !user ? null : editing ? (editRouteId && editReady ? `taku:draft:route-edit:${editRouteId}:${user.id}` : null) : `taku:draft:route-new:${user.id}`
  const draft = useFormDraft<BuilderDraft>(
    draftKey,
    draftData,
    d => {
      if (Array.isArray(d.added)) setAdded(d.added)
      if (d.moveTips) setMoveTips(d.moveTips)
      setTitle(d.title ?? ''); setDesc(d.desc ?? ''); if (d.difficulty) setDifficulty(d.difficulty)
      setCoverUrl(d.coverUrl ?? ''); setThemes(d.themes ?? []); setTarget(d.target ?? ''); setTips(d.tips ?? '')
      setPrimaryTagId(d.primaryTagId ?? null); setSelectedTag(d.selectedTag ?? null)
      if (d.floorMaps) setFloorMaps(d.floorMaps)
      if (Array.isArray(d.sources)) setSources(d.sources)
      if (d.orderMode) { setOrderMode(d.orderMode); autoResultRef.current = d.added ?? null }   // "층별 안내" 선택 표시 유지
      if (d.step) setStep(d.step)
    },
    d => editing
      ? sig(d) === baselineRef.current
      : d.added.length === 0 && !d.title.trim() && !d.desc.trim() && d.sources.every(x => !x.name.trim() && !x.url.trim()),
  )
  // 샵 정보(층수 등)를 고치고 돌아왔을 때 — 담아 둔 샵을 새로 불러온 최신 정보로 바꿔 끼운다 (순서는 그대로)
  useEffect(() => {
    if (!candidates.length) return
    const byId = new Map(candidates.map(c => [c.id, c]))
    setAdded(prev => {
      if (!prev.some(x => byId.has(x.id))) return prev
      const next = prev.map(x => byId.get(x.id) ?? x)
      if (autoResultRef.current === prev) autoResultRef.current = next   // 자동 정렬 표시는 유지
      return next
    })
  }, [candidates])
  function draftStartOver() {
    draft.discard()
    if (editing) { window.location.reload(); return }   // 수정: 저장된 루트 내용으로 다시
    setAdded([]); setMoveTips({}); setTitle(''); setDesc(''); setDifficulty(1); setCoverUrl(''); setThemes([]); setTarget(''); setTips('')
    setPrimaryTagId(null); setSelectedTag(null); setFloorMaps({}); setSources([]); setOrderMode(null); setOrderBefore(null); setStep(1)
  }

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

  /* 루트는 공개가 기본이다. 비공개 = "임시 저장"(아직 다 못 만든 루트)뿐.
     - 저장하기/변경사항 저장 : 이름 + 샵 2곳 이상 필요, 저장하면 바로 공개 (임시 저장 루트를 불러와 저장해도 공개)
     - 임시 저장           : 이름 + 샵 1곳 이상이면 언제든, 나만 보는 상태로 남김 (공개된 루트는 임시 저장으로 못 돌린다) */
  async function save(asDraft = false) {
    if (!user) return
    if (!title.trim()) { setMsg('루트 이름을 입력하세요'); setStep(1); return }
    if (added.length < (asDraft ? 1 : 2)) { setMsg(asDraft ? '샵을 1곳 이상 담으면 임시 저장할 수 있어요' : '샵을 2개 이상 담아주세요'); setStep(2); return }
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
      { const maps = floorMapsToSave(); const ok2 = await saveRouteFloorMaps(editRouteId, maps); if (!ok2 && maps.length) window.alert('층 지도 이미지는 저장하지 못했어요. (DB에 floor_maps 칸이 필요해요)') }
      { const src = sourcesToSave(); const ok3 = await saveRouteSources(editRouteId, src); if (!ok3 && src.length) window.alert('출처는 저장하지 못했어요. (DB에 source_credits 칸이 필요해요)') }
      // 임시 저장 루트를 "공개하기"로 저장하면 공개로 바꾼다 (작성자만 — 추천 루트는 이미 공개)
      if (!asDraft && !shared && isOwner) {
        const pub = await toggleRouteShare(editRouteId, user.id, true)
        if (!pub) { setSaving(false); setMsg('저장은 됐지만 공개하지 못했어요. 다시 눌러주세요.'); return }
        setShared(true)
      }
      setSaving(false)
      draft.clear()
      router.push(asDraft ? '/profile?tab=routes' : `/route/${editToken}`)
      return
    }
    const res = await createRoute(user.id, title.trim(), desc.trim(), shopInput, difficulty)
    if (!res) { setSaving(false); setMsg('루트 생성 실패'); return }
    await updateRouteMeta(res.id, meta)
    { const maps = floorMapsToSave(); if (maps.length && !(await saveRouteFloorMaps(res.id, maps))) window.alert('층 지도 이미지는 저장하지 못했어요. (DB에 floor_maps 칸이 필요해요)') }
    { const src = sourcesToSave(); if (src.length && !(await saveRouteSources(res.id, src))) window.alert('출처는 저장하지 못했어요. (DB에 source_credits 칸이 필요해요)') }
    if (!asDraft) {
      const pub = await toggleRouteShare(res.id, user.id, true)
      if (!pub) { setSaving(false); draft.clear(); setMsg('저장은 됐지만 공개하지 못했어요. 내 루트에서 이어서 공개해 주세요.'); router.push('/profile?tab=routes'); return }
    }
    setSaving(false)
    draft.clear()
    router.push(asDraft ? '/profile?tab=routes' : `/route/${res.shareToken}`)
  }

  async function doDelete() {
    if (!user || !editRouteId) return
    if (!confirm('이 루트를 삭제할까요? 되돌릴 수 없어요.')) return
    const ok = await deleteRoute(editRouteId, user.id)
    if (ok) router.push('/routes')
    else setMsg('삭제 실패')
  }

  if (!user) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>로그인하면 루트를 만들 수 있어요.</div>
  if (editing && loadingEdit) return <LogoLoader size="md" text="루트 불러오는 중…" />
  /* 수정 권한: 관리자는 모든 루트, 작성자는 추천(공식) 지정 전 루트만 (추천 지정 때 "이후 관리자만 편집" 약속) */
  if (editing && !(isAdmin || (isOwner && !isOfficial))) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>{isOfficial ? '추천 루트는 관리자만 수정할 수 있어요.' : '이 루트를 수정할 권한이 없어요.'}</div>

  // 임시 저장: 새 루트, 또는 아직 공개 안 한 내 루트 (추천 루트·남의 루트는 해당 없음)
  const canDraft = !shared && (!editing || (isOwner && !isOfficial))
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
        .rb-head{ position:sticky; top:0; z-index:35; background:var(--bg, #fff); padding:10px 0; margin-top:-10px; }
        @media (hover:none) and (pointer:coarse){
          .rb-root{ padding:12px 14px 96px !important; }
          .rb-form{ padding:16px 16px !important; border-radius:14px !important; border-left:none !important; border-right:none !important; margin:0 -14px !important; }
          .rb-bottom{ position:fixed !important; left:0; right:0; bottom:0; }
        }
      `}</style>
      {/* 전용 헤더 — 뒤로 · 루트 만들기 · [저장하기|임시 저장] · 나가기 (스크롤해도 위에 붙어 있음)
          공개된 루트 수정: 어느 단계에서든 바로 "저장하기" / 새 루트·아직 공개 안 한 루트: 같은 자리에 "임시 저장" */}
      <div className="rb-head" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={requestExit} style={iconBtn} aria-label="뒤로"><Svg><path d="m15 18-6-6 6-6" /></Svg></button>
        <h1 style={{ flex: 1, minWidth: 0, fontSize: 20, fontWeight: 900, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{editing ? '루트 수정' : '루트 만들기'}</h1>
        {canDraft ? (
          <button onClick={() => save(true)} disabled={saving || !editReady} style={{ ...ghostBtn, fontWeight: 800, color: 'var(--accent)', borderColor: 'var(--accent)' }}>{saving ? '저장 중…' : '임시 저장'}</button>
        ) : editing ? (
          <button onClick={() => save(false)} disabled={saving || !editReady} style={{ ...ghostBtn, fontWeight: 800, border: 'none', background: saving ? 'var(--border)' : 'var(--accent)', color: '#fff' }}>{saving ? '저장 중…' : '저장하기'}</button>
        ) : null}
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
          {draft.restored && <DraftNotice text={editing ? '수정 중이던 내용을 불러왔어요.' : '만들던 루트를 불러왔어요.'} onDiscard={draftStartOver} onClose={draft.dismiss} />}
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

              {/* 출처 — 다른 분의 인스타·블로그 코스를 참고했다면 (루트 소개에 링크로 보여요) */}
              <Label>출처 <span style={{ fontWeight: 600, color: 'var(--muted)' }}>· 선택</span></Label>
              <div style={{ fontSize: 12, color: 'var(--muted)', margin: '-2px 0 8px', lineHeight: 1.5 }}>다른 분의 인스타·블로그 코스를 참고했다면 남겨주세요. 루트 소개에 링크로 보여요.</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
                {sources.map((x, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 3fr) auto', gap: 6, alignItems: 'center' }}>
                    <input value={x.name} onChange={e => setSources(prev => prev.map((y, j) => j === i ? { ...y, name: e.target.value } : y))} maxLength={40}
                      placeholder="이름 (예: @계정, OO 블로그)" aria-label={`출처 ${i + 1} 이름`} style={{ ...inp, marginBottom: 0 }} />
                    <input value={x.url} onChange={e => setSources(prev => prev.map((y, j) => j === i ? { ...y, url: e.target.value } : y))} maxLength={300} inputMode="url"
                      placeholder="링크 (인스타·블로그 주소)" aria-label={`출처 ${i + 1} 링크`} style={{ ...inp, marginBottom: 0 }} />
                    <button type="button" onClick={() => setSources(prev => prev.filter((_, j) => j !== i))} style={{ ...smallBtn, color: 'var(--red)' }} aria-label={`출처 ${i + 1} 삭제`}><Svg size={13}><path d="M6 6l12 12M18 6 6 18" /></Svg></button>
                  </div>
                ))}
                {sources.length < 5 && (
                  <button type="button" onClick={() => setSources(prev => [...prev, { name: '', url: '' }])}
                    style={{ ...ghostBtn, alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <Svg size={14}><path d="M12 5v14M5 12h14" /></Svg>출처 추가
                  </button>
                )}
              </div>

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
                <div style={{ marginBottom: 14, border: '1px solid var(--border)', borderRadius: 12, padding: '12px 12px 10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 800 }}>순서 자동으로 정하기</span>
                    {orderBefore && (
                      <button type="button" onClick={() => { autoResultRef.current = null; setAdded(orderBefore); setOrderBefore(null); setOrderMode(null); setOrderNote(null) }}
                        style={{ border: 'none', background: 'none', color: 'var(--muted)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>원래 순서로</button>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
                    {([
                      { m: 'floor', label: '층별 안내', sub: '같은 건물은 낮은 층부터' },
                      { m: 'walk', label: '도보 안내', sub: '가까운 곳부터 차례로' },
                      { m: 'both', label: '둘 다', sub: '건물은 도보 순, 안은 층 순' },
                    ] as { m: AutoOrderMode; label: string; sub: string }[]).map(o => {
                      const on = orderMode === o.m
                      return (
                        <button key={o.m} type="button" aria-pressed={on}
                          onClick={() => applyAutoOrder(o.m)}
                          style={{ minWidth: 0, minHeight: 52, padding: '7px 6px', borderRadius: 10, border: on ? '1.5px solid var(--accent)' : '1px solid var(--border)', background: on ? 'var(--accent-l)' : 'var(--surface)', color: on ? 'var(--accent)' : 'var(--text)', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                          <span style={{ fontSize: 13, fontWeight: 800 }}>{o.label}</span>
                          <span style={{ fontSize: 10.5, fontWeight: 600, color: on ? 'var(--accent)' : 'var(--muted)', lineHeight: 1.3, wordBreak: 'keep-all' }}>{o.sub}</span>
                        </button>
                      )
                    })}
                  </div>
                  {orderNote && <div role="status" style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginTop: 8, lineHeight: 1.5 }}>{orderNote}</div>}
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 8, lineHeight: 1.5 }}>
                    도보 순서는 지금 1번 샵에서 출발해요. 층은 샵 정보의 층수(B1·3F·5층 등)로 정해요. 정한 뒤에도 꾹 눌러 직접 바꿀 수 있어요.
                    {orderMode && Object.values(moveTips).some(v => v.trim()) && <> 순서가 바뀌었으니 아래 <b>구간 이동 팁</b>도 펼쳐서 한 번 확인해 주세요.</>}
                  </div>
                </div>
              )}
              {added.length >= 2 && (
                <div style={{ marginBottom: 16 }}><RouteMiniMap stops={mapStops} /></div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)' }}>루트 순서 ({added.length}) · 꾹 눌러 이동</div>
                <input ref={floorMapInput} type="file" accept="image/*" hidden onChange={onFloorMapFile} />
                <button onClick={() => setStep(1)} style={{ ...ghostBtn, flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5 }}><Svg size={14}><path d="M12 5v14M5 12h14" /></Svg>샵 더 담기</button>
              </div>
              {added.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 13, border: '1px dashed var(--border)', borderRadius: 10 }}>1단계에서 샵을 담아주세요</div>
              ) : (
                <div ref={listRef} style={{ touchAction: drag ? 'none' : undefined }}>
                  {added.map((s, i) => {
                    const dragging = drag?.id === s.id
                    const transform = dragging ? `translateY(${drag!.dy}px)` : undefined
                    // 층별 묶음 제목 — 앞 샵과 건물·층이 달라지는 곳마다 (끄는 중엔 숨겨서 순서 계산이 흔들리지 않게)
                    const gKey = floorGroupKey(s as any)
                    const showHead = !drag && showFloorGroups && (i === 0 || floorGroupKey(added[i - 1] as any) !== gKey)
                    const gLabel = floorGroupLabel(s as any)
                    const fm = floorMaps[gKey]
                    return (
                    <Fragment key={s.id}>
                    {showHead && (
                      <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: i === 0 ? '4px 2px 8px' : '14px 2px 8px' }}>
                        <span style={{ minWidth: 0, fontSize: 12.5, fontWeight: 800, color: 'var(--accent)', background: 'var(--accent-l)', borderRadius: 9999, padding: '4px 10px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{gLabel}</span>
                        <span style={{ flex: 1 }} />
                        {fm ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            <a href={fm.url} target="_blank" rel="noreferrer" title="층 지도 크게 보기" style={{ display: 'block', width: 40, height: 40, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface2)' }}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={fm.url} alt={`${gLabel} 층 지도`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                            </a>
                            <button type="button" onClick={() => pickFloorMap(gKey, gLabel)} disabled={floorMapBusy === gKey} style={smallBtn}>{floorMapBusy === gKey ? '올리는 중…' : '사진 바꾸기'}</button>
                            <button type="button" onClick={() => setFloorMaps(prev => { const n = { ...prev }; delete n[gKey]; return n })} style={{ ...smallBtn, color: 'var(--red)' }}>삭제</button>
                          </span>
                        ) : (
                          <button type="button" onClick={() => pickFloorMap(gKey, gLabel)} disabled={floorMapBusy === gKey}
                            style={{ ...smallBtn, flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Svg size={14}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="m21 16-5-5-8 8" /></Svg>{floorMapBusy === gKey ? '올리는 중…' : '층 지도 사진 추가'}
                          </button>
                        )}
                      </div>
                      </>
                    )}
                    <div ref={(el) => { rowRefs.current[i] = el }}
                      onPointerDown={(e) => startDrag(e, i)}
                      draggable={false} onDragStart={(e) => e.preventDefault()}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 4px', borderBottom: '1px solid var(--border)', background: dragging ? 'var(--accent-l, #FFE6EF)' : 'var(--surface)', boxShadow: dragging ? '0 6px 18px rgba(0,0,0,.16)' : 'none', borderRadius: dragging ? 10 : 0, position: 'relative', zIndex: dragging ? 20 : 1, transform, transition: dragging ? 'none' : 'transform .15s', cursor: 'grab', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}>
                      <span style={{ width: 22, height: 22, borderRadius: 9999, background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span>
                      <button onPointerDown={(e) => e.stopPropagation()} onClick={() => move(i, -1)} disabled={i === 0} style={{ ...smallBtn, opacity: i === 0 ? 0.3 : 1 }} aria-label="위로"><Svg size={13}><path d="m18 15-6-6-6 6" /></Svg></button>
                      <button onPointerDown={(e) => e.stopPropagation()} onClick={() => move(i, 1)} disabled={i === added.length - 1} style={{ ...smallBtn, opacity: i === added.length - 1 ? 0.3 : 1 }} aria-label="아래로"><Svg size={13}><path d="m6 9 6 6 6-6" /></Svg></button>
                      <button onPointerDown={(e) => e.stopPropagation()} onClick={() => remove(s.id)} style={{ ...smallBtn, color: 'var(--red)' }} aria-label="삭제"><Svg size={13}><path d="M6 6l12 12M18 6 6 18" /></Svg></button>
                    </div>
                    </Fragment>
                    )
                  })}
                </div>
              )}
              {added.length >= 2 && (
                <div style={{ marginTop: 20, border: '1px solid var(--border)', borderRadius: 12 }}>
                  {(() => {
                    const filled = added.slice(0, -1).filter(s => (moveTips[s.id] ?? '').trim()).length
                    return (
                      <button type="button" onClick={() => setTipsOpen(v => !v)} aria-expanded={tipsOpen}
                        style={{ width: '100%', minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                        <span style={{ minWidth: 0 }}>
                          <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text)' }}>구간 이동 팁 <span style={{ fontWeight: 600, color: 'var(--muted)' }}>· 선택</span></span>
                          <span style={{ display: 'block', fontSize: 12, color: filled ? 'var(--accent)' : 'var(--muted)', fontWeight: filled ? 700 : 500, marginTop: 2 }}>
                            {filled ? `${filled}개 구간에 팁을 적었어요` : '스팟 사이 이동 팁을 남길 수 있어요'}
                          </span>
                        </span>
                        <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12.5, fontWeight: 700, color: 'var(--muted)' }}>
                          {tipsOpen ? '접기' : '펼치기'}
                          <Svg size={14}><path d={tipsOpen ? 'm18 15-6-6-6 6' : 'm6 9 6 6 6-6'} /></Svg>
                        </span>
                      </button>
                    )
                  })()}
                  {tipsOpen && (
                  <div style={{ padding: '0 12px 12px' }}>
                  <div style={{ fontSize: 12, color: 'var(--muted)', margin: '0 2px 10px' }}>예: 지하상가로 가면 더 빨라요</div>
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
                </div>
              )}
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
              {/* 루트 삭제는 내 일반 루트에서만. 추천 루트는 관리자 > 추천 루트 관리에서 */}
              {editing && isOwner && !isOfficial && (
                <>
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
        {/* 임시 저장은 위 헤더로 옮겼다 (스크롤해도 항상 보이게) */}
        {step < STEPS.length ? (
          <button onClick={() => { if (canNext) { setStep((s) => Math.min(STEPS.length, s + 1)); setMsg(null) } else { setMsg(curIssue) } }} disabled={!canNext} style={{ flex: 1, minWidth: 0, minHeight: 50, borderRadius: 12, border: 'none', background: canNext ? 'var(--accent)' : 'var(--border)', color: '#fff', fontWeight: 800, fontSize: 15, cursor: canNext ? 'pointer' : 'default', fontFamily: 'inherit', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{canNext ? nextLabel : (curIssue ?? nextLabel)}</button>
        ) : (
          <button onClick={() => save(false)} disabled={saving} style={{ flex: 1, minWidth: 0, minHeight: 50, borderRadius: 12, border: 'none', background: saving ? 'var(--border)' : 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 15, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit' }}>{saving ? '저장 중…' : (editing && shared ? '변경사항 저장' : '저장하기')}</button>
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
