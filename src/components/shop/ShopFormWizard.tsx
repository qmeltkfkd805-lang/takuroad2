'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { CATEGORIES, WEEKDAYS, WEEKDAY_LABEL } from '@/lib/constants/categories'
import { ROUTES } from '@/lib/constants/routes'
import { createShop, updateShop } from '@/services/shopService'
import { Shop, ShopFormData } from '@/types/shop'
import { BusinessHours } from '@/types/database'
import { generateSlug } from '@/lib/utils/shop'
import { geocodeAddress, searchPlace, PlaceSearchResult } from '@/lib/utils/geocode'
import { findPlaceByAddr } from '@/services/placeService'
import AdminPlaceLink from './AdminPlaceLink'
import { getTodayStatus } from '@/lib/utils/date'
import ShopEnrichmentSection from './ShopEnrichmentSection'
import ShopAmenitySection from './ShopAmenitySection'
import ShopHighlightManager from './ShopHighlightManager'
import PhotosManage from './PhotosManage'
import CompletenessIndicator from './CompletenessIndicator'

interface Props {
  mode: 'create' | 'edit'
  shop?: Shop
}

const STEPS = [
  { n: 1, label: '기본 정보' },
  { n: 2, label: '사진' },
  { n: 3, label: '취급 작품 & 상품' },
  { n: 4, label: '사진' },
  { n: 5, label: '편의시설' },
  { n: 6, label: '확인 & 등록' },
]

const TIPS = [
  '정확한 정보일수록 더 많은 사람들이 찾아와요.',
  '대표 이미지는 가로 비율의 선명한 사진이 좋아요.',
  '취급 작품과 상품 정보를 자세히 입력해주세요.',
  '운영 정보는 최신 정보로 유지해주세요.',
  '등록 후에도 언제든 수정할 수 있어요.',
]

const EMPTY_FORM: ShopFormData = {
  name: '', slug: '', description: '', addr: '',
  lat: null, lng: null, cats: [],
  hours: null, parking: null, parking_note: '',
  shop_link: '', sns_links: [], phone: '', floor_info: '', start_date: '', end_date: '', event_info: '',
  place_id: null, place_name: null, floor: '', unit: '',
}

export default function ShopFormWizard({ mode, shop }: Props) {
  const router = useRouter()
  const { user, isAdmin } = useAuth()

  const [form, setForm] = useState<ShopFormData>(EMPTY_FORM)
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedNote, setSavedNote] = useState('')
  const [placeResults, setPlaceResults] = useState<PlaceSearchResult[]>([])
  const [searchingPlace, setSearchingPlace] = useState(false)
  const [createdShopId, setCreatedShopId] = useState<string | null>(null)
  const [createdShopSlug, setCreatedShopSlug] = useState<string | null>(null)
  const [links, setLinks] = useState<string[]>([''])
  const [bulkOpen, setBulkOpen] = useState('10:00')
  const [bulkClose, setBulkClose] = useState('20:00')
  const [pickDays, setPickDays] = useState<string[]>([])
  const [breakOn, setBreakOn] = useState(false)
  const [bulkBreakStart, setBulkBreakStart] = useState('15:00')
  const [bulkBreakEnd, setBulkBreakEnd] = useState('16:00')

  useEffect(() => { if (!user) router.push(ROUTES.login) }, [user, router])

  useEffect(() => {
    if (mode === 'edit' && shop) {
      setForm({
        name: shop.name, slug: shop.slug, description: shop.description ?? '', addr: shop.addr ?? '',
        lat: shop.lat, lng: shop.lng, cats: shop.cats, hours: shop.hours,
        parking: shop.parking, parking_note: shop.parking_note ?? '',
        shop_link: shop.shop_link ?? '', sns_links: (shop as any).sns_links?.length ? (shop as any).sns_links : (shop.shop_link ? [shop.shop_link] : []), phone: shop.phone ?? '', floor_info: shop.floor_info ?? '',
        start_date: shop.start_date ?? '', end_date: shop.end_date ?? '', event_info: shop.event_info ?? '',
        place_id: shop.place_id ?? null, place_name: shop.place_name ?? null, floor: shop.floor ?? '', unit: shop.unit ?? '',
      })
      const initLinks = (shop as any).sns_links?.length ? (shop as any).sns_links : (shop.shop_link ? [shop.shop_link] : [])
      setLinks(initLinks.length ? initLinks : [''])
    }
  }, [mode, shop])

  const shopId = mode === 'edit' ? shop?.id ?? null : createdShopId
  const shopSlug = mode === 'edit' ? shop?.slug ?? null : createdShopSlug
  const canEnrich = !!shopId

  function set(key: keyof ShopFormData, value: any) {
    setForm(prev => ({ ...prev, [key]: value }))
  }
  function handleNameChange(name: string) {
    set('name', name)
    if (mode === 'create') set('slug', generateSlug(name))
  }
  async function handlePlaceSearch() {
    if (!form.addr.trim()) return
    setSearchingPlace(true)
    setPlaceResults(await searchPlace(form.addr))
    setSearchingPlace(false)
  }
  const [placeLinking, setPlaceLinking] = useState(false)

  async function selectPlace(place: PlaceSearchResult) {
    set('addr', place.roadAddress)
    set('lat', place.lat)
    set('lng', place.lng)
    setPlaceResults([])

    // 이 주소가 학습된 장소(place_address_map)에 있으면 자동 연결.
    // 없으면 독립 매장 — place는 관리자가 샵 편집에서 지정할 때만 생긴다.
    setPlaceLinking(true)
    const matched = await findPlaceByAddr(place.roadAddress || place.address)
    setPlaceLinking(false)
    if (matched) {
      setForm(prev => ({ ...prev, place_id: matched.id, place_name: matched.name }))
    } else {
      setForm(prev => ({ ...prev, place_id: null, place_name: null }))
    }
  }
  // 첫 링크만 DB(shop_link)에 저장됨. 여러 개 저장하려면 sns_links 컬럼 필요.
  function updateLinks(next: string[]) {
    setLinks(next)
    const clean = next.map(l => l.trim()).filter(Boolean)
    set('sns_links', clean)
    set('shop_link', clean[0] ?? '')
  }
  function toggleAllDays() {
    const applied = WEEKDAYS.every(d => { const dh: any = (form.hours as any)?.[d]; return dh && dh.open === bulkOpen && dh.close === bulkClose })
    const h: any = { ...(form.hours ?? {}) }
    WEEKDAYS.forEach(d => { h[d] = applied ? null : { open: bulkOpen, close: bulkClose } })
    set('hours', h)
  }
  function toggleHoliday() {
    const h: any = { ...(form.hours ?? {}) }
    if (h.holiday === 'closed') delete h.holiday; else { h.holiday = 'closed'; delete h.yearRound }
    set('hours', h)
  }
  function toggleYearRound() {
    const h: any = { ...(form.hours ?? {}) }
    if (h.yearRound) delete h.yearRound; else { h.yearRound = true; delete h.holiday }
    set('hours', h)
  }
  // 선택한 요일에만 일괄 시간 적용
  function applyBulkToDays(days: string[]) {
    const h: any = { ...(form.hours ?? {}) }
    days.forEach(d => { h[d] = { ...(h[d] || {}), open: bulkOpen, close: bulkClose } })
    set('hours', h)
  }
  function applySelectedDays() { if (pickDays.length > 0) applyBulkToDays(pickDays) }
  function togglePickDay(day: string) {
    setPickDays(p => p.includes(day) ? p.filter(x => x !== day) : [...p, day])
  }
  // 휴게시간 켜기/끄기 (끄면 모든 요일 휴게 제거)
  function toggleBreak() {
    const anyBreak = WEEKDAYS.some(d => !!(form.hours as any)?.[d]?.breakStart)
    if (breakOn || anyBreak) {
      const h: any = { ...(form.hours ?? {}) }
      WEEKDAYS.forEach(d => { if (h[d]) h[d] = { open: h[d].open, close: h[d].close } })
      set('hours', h)
      setBreakOn(false)
    } else {
      setBreakOn(true)
    }
  }
  // 영업 중인 요일에 휴게시간 일괄 적용
  function applyBreakToOpenDays() {
    const h: any = { ...(form.hours ?? {}) }
    WEEKDAYS.forEach(d => { if (h[d]) h[d] = { ...h[d], breakStart: bulkBreakStart, breakEnd: bulkBreakEnd } })
    set('hours', h)
  }

  async function saveCore(): Promise<boolean> {
    if (!user) return false
    if (!form.name.trim()) { setError('샵 이름을 입력해주세요'); return false }
    if (form.cats.length === 0) { setError('카테고리를 선택해주세요'); return false }
    setSaving(true); setError('')

    let finalForm = form
    if (form.addr.trim() && !form.lat) {
      const coords = await geocodeAddress(form.addr)
      if (coords) { finalForm = { ...form, lat: coords.lat, lng: coords.lng }; setForm(finalForm) }
    }

    if (mode === 'create' && !createdShopId) {
      const result = await createShop(finalForm, user.id)
      if (!result) { setError('등록에 실패했어요. 슬러그가 중복되었을 수 있어요.'); setSaving(false); return false }
      setCreatedShopId(result.id); setCreatedShopSlug(result.slug)
    } else if (shopId) {
      const ok = await updateShop(shopId, finalForm, user.id)
      if (!ok) { setError('저장에 실패했어요.'); setSaving(false); return false }
    }
    setSaving(false)
    return true
  }

  async function handleTempSave() {
    const ok = await saveCore()
    if (ok) { setSavedNote(mode === 'edit' ? '저장됐어요 ✓' : '임시저장됐어요'); setTimeout(() => setSavedNote(''), 2000) }
  }
  async function goNext() {
    if (step === 1) { if (!(await saveCore())) return }
    setStep(s => Math.min(6, s + 1))
  }
  function goPrev() { setStep(s => Math.max(1, s - 1)) }
  function goToStep(n: number) { if (n === 1 || canEnrich) setStep(n) }
  async function finish() {
    if (mode === 'edit') { if (!(await saveCore())) return; router.push(ROUTES.shop(shop!.slug)); return }
    router.push(shopSlug ? ROUTES.shop(shopSlug) : '/profile?tab=shops')
  }

  const guide = [
    { label: '샵 이름', ok: !!form.name.trim() },
    { label: '카테고리', ok: form.cats.length > 0 },
    { label: '주소', ok: !!form.addr.trim() },
    { label: '영업시간', ok: !!form.hours && Object.values(form.hours).some(Boolean) },
    { label: '저장', ok: canEnrich },
  ]

  const allDaysApplied = WEEKDAYS.every(d => { const dh: any = (form.hours as any)?.[d]; return dh && dh.open === bulkOpen && dh.close === bulkClose })
  const showBreak = breakOn || WEEKDAYS.some(d => !!(form.hours as any)?.[d]?.breakStart)
  const previewCat = CATEGORIES.find(c => form.cats.includes(c.name))
  const previewStatus = getTodayStatus(form.hours)
  const previewImg = mode === 'edit' ? (shop?.images?.[0] ?? null) : null

  return (
    <div style={{ maxWidth: 1320, margin: '0 auto', padding: '20px 32px 60px' }}>
      <style>{`.taku-page-2col{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:28px;align-items:start}@media (hover:none) and (pointer:coarse) and (max-width:900px){.taku-page-2col{grid-template-columns:1fr}}`}</style>

      {/* 헤더 */}
      <div style={{ position: 'sticky', top: 64, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, padding: '12px 0', background: 'var(--bg, var(--surface))', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => router.back()} style={iconBtn} aria-label="뒤로"><Svg><path d="m15 18-6-6 6-6" /></Svg></button>
          <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0 }}>{mode === 'edit' ? '샵 수정' : '샵 등록'}</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {savedNote && <span style={{ fontSize: 13, color: 'var(--green)', fontWeight: 700 }}>{savedNote}</span>}
          <button onClick={handleTempSave} disabled={saving} style={mode === 'edit' ? { ...ghostBtn, background: 'var(--accent)', color: '#fff', border: 'none', fontWeight: 800 } : ghostBtn}>{saving ? '저장 중...' : mode === 'edit' ? '저장하기' : '임시저장'}</button>
          <button onClick={() => router.back()} style={ghostBtn}>나가기</button>
        </div>
      </div>

      {/* 스텝바 */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 28, paddingBottom: 6 }}>
        {STEPS.map((s) => {
          const active = step === s.n
          const done = step > s.n
          const reachable = s.n === 1 || canEnrich
          return (
            <button key={s.n} onClick={() => goToStep(s.n)} disabled={!reachable}
              style={{ flex: '1 0 auto', display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px', border: 'none', background: 'none', cursor: reachable ? 'pointer' : 'default', fontFamily: 'inherit', opacity: reachable ? 1 : 0.5, borderBottom: `3px solid ${active ? 'var(--accent)' : 'transparent'}` }}>
              <span style={{ width: 28, height: 28, borderRadius: 9999, flexShrink: 0, fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', background: active || done ? 'var(--accent)' : 'var(--surface2)', color: active || done ? '#fff' : 'var(--muted)' }}>{done ? <CheckIcon size={12} color="#fff" /> : s.n}</span>
              <span style={{ fontSize: 15, fontWeight: active ? 800 : 600, color: active ? 'var(--text)' : 'var(--muted)', whiteSpace: 'nowrap' }}>{s.label}</span>
            </button>
          )
        })}
      </div>

      {/* 2컬럼: 폼 카드 + 미리보기/TIP (좁으면 세로로 쌓임) */}
      <div className="taku-page-2col">

      {/* 폼 카드 */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 18, padding: 32, background: 'var(--surface)' }}>

        {/* 작성 가이드 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 22, padding: '12px 14px', background: 'var(--surface2)', borderRadius: 12 }}>
          <span style={{ fontSize: 12.5, fontWeight: 900, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 5, marginRight: 2 }}><Svg size={15} color="var(--accent)" fill="var(--accent)"><path d="M12 2l3 6.3 6.9.9-5 4.8 1.2 6.8L12 17.8 5.9 20.8 7 14 2 9.2l6.9-.9L12 2Z" /></Svg>작성 가이드</span>
          {guide.map((g) => (
            <span key={g.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, padding: '6px 11px', borderRadius: 9999, background: 'var(--surface)', border: `1px solid ${g.ok ? 'var(--accent)' : 'var(--border)'}`, color: g.ok ? 'var(--accent)' : 'var(--muted)' }}>
              <span style={{ width: 16, height: 16, borderRadius: 9999, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: g.ok ? 'var(--accent)' : 'var(--surface2)' }}>{g.ok ? <CheckIcon size={11} color="#fff" /> : <span style={{ width: 5, height: 5, borderRadius: 9999, background: 'var(--muted)' }} />}</span>
              {g.label}
            </span>
          ))}
        </div>

        {/* STEP 1 — 기본 정보 */}
        {step === 1 && (
          <>
            <StepHead icon={<Svg size={20} color="var(--accent)"><path d="M3 9l9-7 9 7v11a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" /></Svg>} title="기본 정보를 입력해주세요" sub="샵의 기본 정보를 입력해주세요. 다음을 누르면 저장돼요." />

            <Field label="샵 이름 *">
              <input value={form.name ?? ''} onChange={e => handleNameChange(e.target.value)} maxLength={50} placeholder="예: 애니메이트 홍대점" style={inp} />
            </Field>

            <Field label="샵 한 줄 소개">
              <textarea value={form.description ?? ''} onChange={e => set('description', e.target.value)} rows={3} maxLength={100} placeholder="예: 다양한 애니메이션 굿즈와 이벤트가 가득한 공간!" style={{ ...inp, resize: 'vertical' }} />
              <div style={{ textAlign: 'right', fontSize: 11.5, color: form.description.length >= 100 ? 'var(--accent)' : 'var(--muted)', marginTop: 4 }}>{form.description.length}/100</div>
            </Field>

            <Field label="샵 카테고리 *" hint="복수 선택 가능">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
                {CATEGORIES.map(cat => {
                  const selected = form.cats.includes(cat.name)
                  return (
                    <button key={cat.slug}
                      onClick={() => setForm(prev => ({ ...prev, cats: selected ? prev.cats.filter(c => c !== cat.name) : [...prev.cats, cat.name] }))}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', borderRadius: 12, cursor: 'pointer', border: `1.5px solid ${selected ? cat.color : 'var(--border)'}`, background: selected ? cat.bgColor : 'var(--surface)', fontFamily: 'inherit', textAlign: 'left' }}>
                      <CatIcon name={cat.icon} color={selected ? cat.color : 'var(--muted)'} size={20} />
                      <span style={{ fontSize: 13, fontWeight: 800, color: selected ? cat.color : 'var(--text)' }}>{cat.name}</span>
                    </button>
                  )
                })}
              </div>
            </Field>

            <Field label="주소" hint="장소명(예: 수원 스타필드)이나 주소를 입력하고 검색해주세요">
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={form.addr ?? ''} onChange={e => { set('addr', e.target.value); set('lat', null); set('lng', null) }}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handlePlaceSearch() } }}
                  placeholder="예: 수원 스타필드, 서울 마포구 와우산로 21" style={{ ...inp, flex: 1 }} />
                <button onClick={handlePlaceSearch} disabled={searchingPlace || !form.addr.trim()}
                  style={{ padding: '0 18px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                  {searchingPlace ? '검색중' : '검색'}
                </button>
              </div>
              {placeResults.length > 0 && (
                <div style={{ marginTop: 8, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                  {placeResults.map((place, i) => (
                    <div key={i} onClick={() => selectPlace(place)} style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: i < placeResults.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{place.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{place.roadAddress}</div>
                    </div>
                  ))}
                </div>
              )}
              {form.lat && form.addr && <p style={{ fontSize: 12, color: 'var(--green)', marginTop: 4 }}><Svg size={12}><path d="m5 12 5 5L20 6" /></Svg> 위치가 설정됐어요</p>}
              {placeLinking && <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>장소 연결 중…</p>}
              {form.place_name && !placeLinking && (
                <p style={{ fontSize: 12, color: 'var(--accent)', marginTop: 4, fontWeight: 700 }}>
                  <Svg size={12}><path d="M9 11a3 3 0 1 0 6 0 3 3 0 0 0-6 0z" /><path d="M17.7 16.7 12 22l-5.7-5.3a8 8 0 1 1 11.4 0z" /></Svg> {form.place_name}에 연결돼요 · 이 장소의 다른 샵·이벤트와 함께 묶여요
                </p>
              )}

              {/* 관리자 학습: 이 주소 = 이 장소 매핑 (편집 모드 + 관리자) */}
              {mode === 'edit' && isAdmin && form.addr && (
                <AdminPlaceLink
                  shopAddr={form.addr}
                  currentPlaceName={form.place_name}
                  onLinked={p => setForm(prev => ({ ...prev, place_id: p.id, place_name: p.name }))}
                />
              )}
            </Field>

            <Field label="상세 위치" hint="건물 내 층수 등">
              <input value={form.floor_info ?? ''} onChange={e => set('floor_info', e.target.value)} placeholder="예: 5층, 지하 1층 B구역" style={inp} />
            </Field>

            <Field label="전화번호">
              <input type="tel" value={form.phone ?? ''} onChange={e => set('phone', e.target.value)} placeholder="예: 02-1234-5678" style={inp} />
            </Field>

            <Field label="공식 SNS / 링크" hint="인스타·X·유튜브·카카오채널·홈페이지 등. 추가 버튼으로 여러 개 넣을 수 있어요.">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {links.map((lnk, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6 }}>
                    <input type="url" value={lnk} onChange={e => { const n = [...links]; n[i] = e.target.value; updateLinks(n) }} placeholder="https://..." style={{ ...inp, flex: 1 }} />
                    {links.length > 1 && <button onClick={() => updateLinks(links.filter((_, j) => j !== i))} aria-label="삭제" style={{ width: 42, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}><Svg size={12}><path d="M18 6 6 18M6 6l12 12" /></Svg></button>}
                  </div>
                ))}
                <button onClick={() => setLinks([...links, ''])} style={{ alignSelf: 'flex-start', padding: '9px 14px', borderRadius: 10, border: '1.5px dashed var(--border)', background: 'transparent', color: 'var(--accent)', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>+ 공식 SNS / 링크 추가</button>
              </div>
            </Field>

            <Field label="영업시간" hint="요일별로 입력. 비우면 휴무로 표시돼요">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12, padding: 12, background: 'var(--surface2)', borderRadius: 10 }}>
                {/* 시간 + 적용 */}
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--muted)' }}>같은 시간</span>
                  <TimeField value={bulkOpen} onChange={setBulkOpen} />
                  <span style={{ color: 'var(--muted)' }}>~</span>
                  <TimeField value={bulkClose} onChange={setBulkClose} />
                  <button onClick={toggleAllDays} style={{ padding: '7px 13px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800, fontSize: 12.5, border: `1.5px solid ${allDaysApplied ? 'var(--accent)' : 'var(--border)'}`, background: allDaysApplied ? 'var(--accent-l, rgba(232,0,111,.08))' : 'var(--surface)', color: allDaysApplied ? 'var(--accent)' : 'var(--text)' }}>{allDaysApplied ? <><Svg size={12}><path d="m5 12 5 5L20 6" /></Svg> 모든 요일 적용</> : '모든 요일 적용'}</button>
                  <button onClick={applySelectedDays} disabled={pickDays.length === 0} style={{ padding: '7px 13px', borderRadius: 8, cursor: pickDays.length ? 'pointer' : 'default', fontFamily: 'inherit', fontWeight: 800, fontSize: 12.5, border: '1.5px solid var(--border)', background: 'var(--surface)', color: pickDays.length ? 'var(--text)' : 'var(--muted)', opacity: pickDays.length ? 1 : .55 }}>선택 요일 적용{pickDays.length ? ` (${pickDays.length})` : ''}</button>
                </div>
                {/* 요일 선택 칩 (선택 요일 적용용) */}
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                  <button onClick={() => setPickDays(['mon', 'tue', 'wed', 'thu', 'fri'])} style={{ padding: '5px 10px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 12, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--muted)' }}>평일</button>
                  <button onClick={() => setPickDays(['sat', 'sun'])} style={{ padding: '5px 10px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 12, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--muted)' }}>주말</button>
                  <span style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 2px' }} />
                  {WEEKDAYS.map(day => {
                    const on = pickDays.includes(day)
                    return (
                      <button key={day} onClick={() => togglePickDay(day)} style={{ width: 30, padding: '5px 0', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 12, border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'var(--accent-l, rgba(232,0,111,.08))' : 'var(--surface)', color: on ? 'var(--accent)' : 'var(--muted)' }}>{WEEKDAY_LABEL[day]}</button>
                    )
                  })}
                  <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>요일 고르고 “선택 요일 적용”</span>
                </div>
                {/* 플래그 + 휴게 토글 */}
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                  <button onClick={toggleHoliday} style={{ padding: '7px 13px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800, fontSize: 12.5, border: `1.5px solid ${(form.hours as any)?.holiday === 'closed' ? 'var(--accent)' : 'var(--border)'}`, background: (form.hours as any)?.holiday === 'closed' ? 'var(--accent-l, rgba(232,0,111,.08))' : 'var(--surface)', color: (form.hours as any)?.holiday === 'closed' ? 'var(--accent)' : 'var(--text)' }}>{(form.hours as any)?.holiday === 'closed' ? <><Svg size={12}><path d="m5 12 5 5L20 6" /></Svg> 공휴일 휴무</> : '공휴일 휴무'}</button>
                  <button onClick={toggleYearRound} style={{ padding: '7px 13px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800, fontSize: 12.5, border: `1.5px solid ${(form.hours as any)?.yearRound ? 'var(--accent)' : 'var(--border)'}`, background: (form.hours as any)?.yearRound ? 'var(--accent-l, rgba(232,0,111,.08))' : 'var(--surface)', color: (form.hours as any)?.yearRound ? 'var(--accent)' : 'var(--text)' }}>{(form.hours as any)?.yearRound ? <><Svg size={12}><path d="m5 12 5 5L20 6" /></Svg> 연중무휴</> : '연중무휴'}</button>
                  <button onClick={toggleBreak} style={{ padding: '7px 13px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800, fontSize: 12.5, border: `1.5px solid ${showBreak ? 'var(--accent)' : 'var(--border)'}`, background: showBreak ? 'var(--accent-l, rgba(232,0,111,.08))' : 'var(--surface)', color: showBreak ? 'var(--accent)' : 'var(--text)' }}>{showBreak ? <><Svg size={12}><path d="m5 12 5 5L20 6" /></Svg> 휴게시간</> : '휴게시간'}</button>
                </div>
                {/* 휴게시간 일괄 (휴게 켰을 때만) */}
                {showBreak && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--muted)' }}>휴게시간</span>
                    <TimeField value={bulkBreakStart} onChange={setBulkBreakStart} />
                    <span style={{ color: 'var(--muted)' }}>~</span>
                    <TimeField value={bulkBreakEnd} onChange={setBulkBreakEnd} />
                    <button onClick={applyBreakToOpenDays} style={{ padding: '7px 13px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800, fontSize: 12.5, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}>휴게시간 모든 요일 적용</button>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {WEEKDAYS.map(day => {
                  const dayHours = form.hours?.[day]
                  const isOpen = !!dayHours
                  const hasBreak = !!(dayHours && (dayHours.breakStart || dayHours.breakEnd))
                  return (
                    <div key={day} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <button onClick={() => { const h: BusinessHours = { ...(form.hours ?? {}) }; h[day] = isOpen ? null : { open: '10:00', close: '20:00' }; set('hours', h) }}
                        style={{ width: 34, flexShrink: 0, padding: '6px 0', borderRadius: 6, border: `1.5px solid ${isOpen ? 'var(--accent)' : 'var(--border)'}`, background: isOpen ? 'var(--accent-l, rgba(232,0,111,.08))' : 'var(--surface)', color: isOpen ? 'var(--accent)' : 'var(--muted)', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                        {WEEKDAY_LABEL[day]}
                      </button>
                      {isOpen && dayHours ? (
                        <>
                          <TimeField value={dayHours.open} onChange={v => { const h: BusinessHours = { ...(form.hours ?? {}) }; h[day] = { ...dayHours, open: v }; set('hours', h) }} />
                          <span style={{ color: 'var(--muted)' }}>~</span>
                          <TimeField value={dayHours.close} onChange={v => { const h: BusinessHours = { ...(form.hours ?? {}) }; h[day] = { ...dayHours, close: v }; set('hours', h) }} />
                          {showBreak && (hasBreak ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 2 }}>
                              <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)' }}>휴게</span>
                              <TimeField value={dayHours.breakStart ?? ''} onChange={v => { const h: BusinessHours = { ...(form.hours ?? {}) }; h[day] = { ...dayHours, breakStart: v }; set('hours', h) }} />
                              <span style={{ color: 'var(--muted)' }}>~</span>
                              <TimeField value={dayHours.breakEnd ?? ''} onChange={v => { const h: BusinessHours = { ...(form.hours ?? {}) }; h[day] = { ...dayHours, breakEnd: v }; set('hours', h) }} />
                              <button onClick={() => { const h: BusinessHours = { ...(form.hours ?? {}) }; h[day] = { open: dayHours.open, close: dayHours.close }; set('hours', h) }} title="휴게 삭제" style={{ width: 24, height: 24, borderRadius: 6, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, lineHeight: 1 }}>×</button>
                            </span>
                          ) : (
                            <button onClick={() => { const h: BusinessHours = { ...(form.hours ?? {}) }; h[day] = { ...dayHours, breakStart: bulkBreakStart, breakEnd: bulkBreakEnd }; set('hours', h) }} style={{ padding: '5px 10px', borderRadius: 6, border: '1.5px dashed var(--border)', background: 'var(--surface)', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 12 }}>+ 휴게</button>
                          ))}
                        </>
                      ) : <span style={{ fontSize: 13, color: 'var(--muted)' }}>휴무</span>}
                    </div>
                  )
                })}
              </div>
            </Field>

            <Field label="주차">
              <div style={{ display: 'flex', gap: 8 }}>
                {[{ label: '모름', value: null }, { label: '가능', value: true }, { label: '불가', value: false }].map(opt => (
                  <button key={String(opt.value)} onClick={() => set('parking', opt.value)}
                    style={{ padding: '8px 18px', borderRadius: 8, cursor: 'pointer', border: `1.5px solid ${form.parking === opt.value ? 'var(--accent)' : 'var(--border)'}`, background: form.parking === opt.value ? 'var(--accent-l, rgba(232,0,111,.08))' : 'var(--surface)', color: form.parking === opt.value ? 'var(--accent)' : 'var(--text)', fontWeight: 700, fontSize: 13, fontFamily: 'inherit' }}>
                    {opt.label}
                  </button>
                ))}
              </div>
              {form.parking !== null && (
                <input value={form.parking_note ?? ''} onChange={e => set('parking_note', e.target.value)} placeholder="주차 메모 (예: 건물 내 2시간 무료)" style={{ ...inp, marginTop: 8 }} />
              )}
            </Field>

            <Field label="팝업 기간" hint="팝업스토어인 경우에만">
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="date" value={form.start_date ?? ''} onChange={e => set('start_date', e.target.value)} style={{ ...inp, flex: 1 }} />
                <span style={{ color: 'var(--muted)' }}>~</span>
                <input type="date" value={form.end_date ?? ''} onChange={e => set('end_date', e.target.value)} style={{ ...inp, flex: 1 }} />
              </div>
              {(form.start_date || form.end_date) && (
                <textarea value={form.event_info ?? ''} onChange={e => set('event_info', e.target.value)} rows={2} placeholder="팝업 이벤트 내용" style={{ ...inp, resize: 'vertical', marginTop: 8 }} />
              )}
            </Field>
          </>
        )}

        {/* STEP 2 — 대표 이미지 */}
        {step === 2 && (
          <>
            <StepHead icon={<Svg size={20} color="var(--accent)"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></Svg>} title="사진" sub="여러 장 올리고 ★대표를 지정하세요. 대표가 샵 카드·상세 히어로에 먼저 보여요." />
            {canEnrich && shopId && shopSlug
              ? <PhotosManage shop={{ id: shopId, slug: shopSlug }} embedded />
              : <NeedSave />}
          </>
        )}

        {/* STEP 3 — 취급 작품 & 상품 */}
        {step === 3 && (
          <>
            <StepHead icon={<Svg size={20} color="var(--accent)"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="M3.3 7 12 12l8.7-5M12 22V12" /></Svg>} title="취급 작품 & 상품" sub="이 샵에서 다루는 작품과 상품을 입력해주세요." />
            {canEnrich && shopId ? <ShopEnrichmentSection shopId={shopId} /> : <NeedSave />}
          </>
        )}

        {/* STEP 4 — 사진 */}
        {step === 4 && (
          <>
            <StepHead icon={<Svg size={20} color="var(--accent)"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></Svg>} title="사진" sub="매장 외관·내부·굿즈 사진을 추가해 샵을 더 잘 보여주세요." />
            {canEnrich && shopId && shopSlug ? <ShopHighlightManager shopId={shopId} shopSlug={shopSlug} /> : <NeedSave />}
          </>
        )}

        {/* STEP 5 — 편의시설 */}
        {step === 5 && (
          <>
            <StepHead icon={<Svg size={20} color="var(--accent)"><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M18.4 5.6l1.4-1.4M4.2 19.8l1.4-1.4" /><circle cx="12" cy="12" r="4" /></Svg>} title="편의시설 & 서비스" sub="주차·예약·포인트 등 이용에 도움이 되는 정보를 선택해주세요." />
            {canEnrich && shopId ? <ShopAmenitySection shopId={shopId} /> : <NeedSave />}
          </>
        )}

        {/* STEP 6 — 확인 & 등록 */}
        {step === 6 && (
          <>
            <StepHead icon={<Svg size={20} color="var(--accent)"><path d="m5 12 5 5L20 6" /></Svg>} title="마지막으로 확인해요" sub="입력한 정보를 확인하고 등록을 완료해주세요." />
            {shopId && <div style={{ marginBottom: 16 }}><CompletenessIndicator shopId={shopId} /></div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
              <ReviewRow label="샵 이름" value={form.name || '미입력'} ok={!!form.name.trim()} />
              <ReviewRow label="카테고리" value={form.cats.join(', ') || '미선택'} ok={form.cats.length > 0} />
              <ReviewRow label="주소" value={form.addr || '미입력'} ok={!!form.addr.trim()} />
              <ReviewRow label="영업시간" value={form.hours && Object.values(form.hours).some(Boolean) ? '입력됨' : '미입력'} ok={!!form.hours && Object.values(form.hours).some(Boolean)} />
            </div>
            {mode === 'create' && <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>등록 후 관리자 승인 후 지도에 표시돼요.</p>}
          </>
        )}

        {error && (
          <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: 'var(--red-l, #fdecec)', color: 'var(--red, #d33)', fontSize: 13, fontWeight: 700 }}>{error}</div>
        )}

        {/* 단계 이동 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <button onClick={goPrev} disabled={step === 1} style={{ ...ghostBtn, opacity: step === 1 ? 0.4 : 1, display: 'inline-flex', alignItems: 'center', gap: 5 }}><Svg size={15}><path d="m15 18-6-6 6-6" /></Svg>이전</button>
          {step < 6 ? (
            <button onClick={goNext} disabled={saving} style={nextBtn}>{saving ? '저장 중...' : '다음 단계'}<Svg size={15} color="#fff"><path d="m9 18 6-6-6-6" /></Svg></button>
          ) : (
            <button onClick={finish} disabled={saving} style={nextBtn}>{mode === 'edit' ? '수정 완료' : '등록 완료'}<CheckIcon size={15} color="#fff" /></button>
          )}
        </div>
      </div>

        {/* 우: 미리보기 + 등록 TIP */}
        <aside style={{ position: 'sticky', top: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 18 }}>
            <h3 style={{ fontSize: 15, fontWeight: 900, marginBottom: 14 }}>샵 미리보기</h3>
            <div style={{ position: 'relative', height: 180, borderRadius: 12, overflow: 'hidden', background: previewCat?.bgColor ?? 'var(--surface2)' }}>
              {previewImg
                ? <img src={previewImg} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                : previewCat
                  ? <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CatIcon name={previewCat.icon} color={previewCat.color} size={54} /></div>
                  : null}

              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg, rgba(0,0,0,.72) 0%, rgba(0,0,0,.2) 46%, rgba(0,0,0,0) 76%)', pointerEvents: 'none' }} />

              <div style={{ position: 'absolute', left: 14, right: 14, bottom: 12, color: '#fff' }}>
                <div style={{ fontSize: 17, fontWeight: 900, textShadow: '0 2px 8px rgba(0,0,0,.4)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{form.name || '샵 이름'}</div>

                {form.cats.length > 0 && (
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
                    {form.cats.slice(0, 3).map(c => (
                      <span key={c} style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 9999, background: 'rgba(255,255,255,.18)', color: '#fff' }}>{c}</span>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12, color: 'rgba(255,255,255,.95)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: 9999, background: previewStatus.isOpen ? '#3ddc97' : '#ff8a8a' }} />
                    <strong style={{ color: previewStatus.isOpen ? '#3ddc97' : '#ff8a8a' }}>{previewStatus.label}</strong>
                    {previewStatus.todayHours && <span>· {previewStatus.todayHours}</span>}
                  </span>
                  {form.addr && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><Svg size={12}><path d="M12 21s-6-5.686-6-10a6 6 0 1 1 12 0c0 4.314-6 10-6 10z" /><circle cx="12" cy="11" r="2" /></Svg> {form.addr}</span>}
                </div>
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--surface2)', borderRadius: 16, padding: 18 }}>
            <h3 style={{ fontSize: 14, fontWeight: 900, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><Svg size={15} color="var(--accent)"><path d="M9 18h6M10 22h4" /><path d="M12 2a7 7 0 0 0-4 12c.5.5 1 1.4 1 2h6c0-.6.5-1.5 1-2a7 7 0 0 0-4-12z" /></Svg>등록 TIP</h3>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, margin: 0, padding: 0 }}>
              {TIPS.map((t, i) => (
                <li key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
                  <span style={{ color: 'var(--accent)', flexShrink: 0, display: 'inline-flex' }}><Svg size={13}><path d="m5 12 5 5L20 6" /></Svg></span>{t}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      {/* 하단 배너 */}
      <div style={{ marginTop: 20, background: 'var(--accent-l, #FFE6EF)', borderRadius: 16, padding: '16px 20px' }}>
        <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--accent)' }}>어렵지 않아요! 6단계만 따라하면 샵 등록 완성</div>
        <div style={{ fontSize: 13, color: 'var(--text)', marginTop: 2 }}>순서대로 채우면 완성돼요. 언제든 임시저장하고 나중에 이어서 할 수 있어요.</div>
      </div>
    </div>
  )
}

/* ---- 작은 컴포넌트/스타일 (RouteBuilder 스타일) ---- */

function StepHead({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
      <span style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: 'var(--accent-l, #FFE6EF)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</span>
      <div>
        <div style={{ fontSize: 16, fontWeight: 900 }}>{title}</div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 6 }}>{label}</div>
      {hint && <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>{hint}</p>}
      {children}
    </div>
  )
}

function ReviewRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'var(--surface2)' }}>
      <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)' }}>{label}</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: ok ? 'var(--text)' : 'var(--red, #d33)', minWidth: 0 }}>
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 260 }}>{value}</span>
        {ok ? <CheckIcon size={14} color="var(--green)" /> : null}
      </span>
    </div>
  )
}

function NeedSave() {
  return <p style={{ color: 'var(--muted)', fontSize: 14 }}>먼저 1단계 기본 정보를 저장해주세요.</p>
}

function Svg({ size = 16, color = 'currentColor', fill = 'none', children }: { size?: number; color?: string; fill?: string; children: React.ReactNode }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0, verticalAlign: '-2px' }}>{children}</svg>
}
const CheckIcon = (p: { size?: number; color?: string }) => <Svg {...p}><path d="m5 12 5 5L20 6" /></Svg>

function CatIcon({ name, color, size = 18 }: { name: string; color: string; size?: number }) {
  return (
    <span style={{
      width: size, height: size, display: 'inline-block', flexShrink: 0,
      backgroundColor: color,
      WebkitMaskImage: `url(/icons/${name}.png)`, maskImage: `url(/icons/${name}.png)`,
      WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
      WebkitMaskSize: 'contain', maskSize: 'contain',
      WebkitMaskPosition: 'center', maskPosition: 'center',
    }} />
  )
}

const inp: React.CSSProperties = {
  width: '100%', padding: '11px 12px', borderRadius: 10, border: '1px solid var(--border)',
  fontFamily: 'inherit', fontSize: 14, background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box', outline: 'none',
}
const ghostBtn: React.CSSProperties = {
  padding: '9px 15px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)',
  color: 'var(--text)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
}
const iconBtn: React.CSSProperties = {
  width: 36, height: 36, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)',
  color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
}

/* 오전/오후를 '글자 클릭'으로 토글하는 시간 입력.
   네이티브 <input type="time">은 오전/오후를 시계 피커로만 바꿀 수 있어 불편 → 커스텀. */
function TimeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [hhStr, mmStr] = (value || '00:00').split(':')
  const hh = Number(hhStr) || 0
  const mm = Number(mmStr) || 0
  const isPM = hh >= 12
  const h12 = hh % 12 === 0 ? 12 : hh % 12

  // 타이핑 중 표시용 로컬 상태. 밖에서 값이 바뀌면(오전/오후 토글·일괄적용) 동기화하되,
  // 입력 중(focused)엔 건드리지 않아 커서/자릿수가 튀지 않게 한다.
  const [focused, setFocused] = useState(false)
  const [hText, setHText] = useState(String(h12))
  const [mText, setMText] = useState(String(mm).padStart(2, '0'))
  useEffect(() => {
    if (!focused) { setHText(String(h12)); setMText(String(mm).padStart(2, '0')) }
  }, [value, focused])   // eslint-disable-line react-hooks/exhaustive-deps

  const commit = (h12v: number, mmv: number, pm: boolean) => {
    const ch = Math.min(12, Math.max(1, h12v || 12))
    const cm = Math.min(59, Math.max(0, mmv || 0))
    const base = (ch % 12) + (pm ? 12 : 0)
    onChange(`${String(base).padStart(2, '0')}:${String(cm).padStart(2, '0')}`)
  }
  const onHour = (raw: string) => { const d = raw.replace(/\D/g, '').slice(0, 2); setHText(d); if (d) commit(Number(d), mm, isPM) }
  const onMin = (raw: string) => { const d = raw.replace(/\D/g, '').slice(0, 2); setMText(d); if (d) commit(h12, Number(d), isPM) }

  const numInp: React.CSSProperties = { ...inp, width: 40, padding: '6px 4px', fontSize: 13, textAlign: 'center', background: 'var(--surface)' }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <button type="button" onClick={() => commit(h12, mm, !isPM)}
        style={{ padding: '6px 9px', borderRadius: 6, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>
        {isPM ? '오후' : '오전'}
      </button>
      <input inputMode="numeric" value={hText} aria-label="시"
        onFocus={e => { setFocused(true); e.target.select() }}
        onBlur={() => { setFocused(false); setHText(String(h12)) }}
        onChange={e => onHour(e.target.value)} style={numInp} />
      <span style={{ color: 'var(--muted)' }}>:</span>
      <input inputMode="numeric" value={mText} aria-label="분"
        onFocus={e => { setFocused(true); e.target.select() }}
        onBlur={() => { setFocused(false); setMText(String(mm).padStart(2, '0')) }}
        onChange={e => onMin(e.target.value)} style={numInp} />
    </span>
  )
}
const nextBtn: React.CSSProperties = {
  padding: '13px 26px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff',
  fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5,
}