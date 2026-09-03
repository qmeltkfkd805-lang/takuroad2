'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { CATEGORIES } from '@/lib/constants/categories'
import { ROUTES } from '@/lib/constants/routes'
import { createShop, updateShop, publishShop } from '@/services/shopService'
import { Shop, ShopFormData } from '@/types/shop'
import { generateSlug } from '@/lib/utils/shop'
import { geocodeAddress, searchPlace, PlaceSearchResult } from '@/lib/utils/geocode'
import { findPlaceByAddr, findPlaceBySameAddr } from '@/services/placeService'
import AdminPlaceLink from './AdminPlaceLink'
import AdminPlaceAccessNote from './AdminPlaceAccessNote'
import { getTodayStatus } from '@/lib/utils/date'
import ShopEnrichmentSection from './ShopEnrichmentSection'
import ShopEventLinkPanel from './ShopEventLinkPanel'
import ShopHighlightManager from './ShopHighlightManager'
import PhotosManage from './PhotosManage'
import CompletenessIndicator from './CompletenessIndicator'
import ShopHoursEditor, { HOURS_HINT } from './ShopHoursEditor'

interface Props {
  mode: 'create' | 'edit'
  shop?: Shop
}

const STEPS = [
  { n: 1, label: '기본 정보' },
  { n: 2, label: '사진' },
  { n: 3, label: '취급 작품 & 상품' },
  { n: 4, label: '추천 코너' },
  { n: 5, label: '확인 & 등록' },
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
  const [ownerAsk, setOwnerAsk] = useState(false)   // 등록 완료 후 "사장님입니까?" 모달
  const [placeResults, setPlaceResults] = useState<PlaceSearchResult[]>([])
  const [searchingPlace, setSearchingPlace] = useState(false)
  const placeBoxRef = useRef<HTMLDivElement>(null)
  // 검색 결과 드롭다운 바깥 클릭 시 닫기 (레이아웃을 밀지 않도록 오버레이로 표시)
  useEffect(() => {
    if (placeResults.length === 0) return
    const onDown = (e: MouseEvent) => { if (placeBoxRef.current && !placeBoxRef.current.contains(e.target as Node)) setPlaceResults([]) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [placeResults.length])
  const [createdShopId, setCreatedShopId] = useState<string | null>(null)
  const [createdShopSlug, setCreatedShopSlug] = useState<string | null>(null)
  const [links, setLinks] = useState<string[]>([''])

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

    // 1) 학습된 장소(place_address_map)에 있으면 자동 연결.
    // 2) 없더라도 완전히 같은 주소의 다른 샵이 이미 장소에 묶여 있으면 그 장소로 연결.
    // 3) 둘 다 없으면 독립 매장.
    setPlaceLinking(true)
    const addr = place.roadAddress || place.address
    const matched = (await findPlaceByAddr(addr)) || (await findPlaceBySameAddr(addr))
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
      // 완료 전까지는 비공개(hidden) 임시 상태. '등록 완료' 눌러야 active로 공개된다.
      const result = await createShop({ ...finalForm, status: 'hidden' }, user.id)
      if (!result) { setError('등록에 실패했어요. 슬러그가 중복되었을 수 있어요.'); setSaving(false); return false }
      setCreatedShopId(result.id); setCreatedShopSlug(result.slug)
      // 이름이 겹쳐 slug에 -2 같은 번호가 붙었을 수 있다 → 폼도 실제 저장된 slug로 맞춘다
      if (result.slug !== finalForm.slug) setForm(f => ({ ...f, slug: result.slug }))
    } else if (shopId) {
      const ok = await updateShop(shopId, finalForm, user.id)
      if (!ok) { setError('저장에 실패했어요.'); setSaving(false); return false }
    }
    setSaving(false)
    return true
  }

  async function handleTempSave() {
    const ok = await saveCore()
    if (!ok) return
    // 수정 모드: 저장하면 이 화면에 머무르지 않고 방금 저장한 샵 상세로 이동
    if (mode === 'edit' && shop?.slug) {
      if (photosDirty && !window.confirm('사진 순서가 아직 저장되지 않았어요.\n저장하지 않고 샵 화면으로 갈까요?')) return
      router.push(ROUTES.shop(shop.slug))
      return
    }
    setSavedNote('임시저장됐어요'); setTimeout(() => setSavedNote(''), 2000)
  }
  async function goNext() {
    if (step === 1) { if (!(await saveCore())) return }
    setStep(s => Math.min(STEPS.length, s + 1))
  }
  function goPrev() { setStep(s => Math.max(1, s - 1)) }
  function goToStep(n: number) { if (n === 1 || canEnrich) setStep(n) }
  async function finish() {
    if (mode === 'edit') { if (!(await saveCore())) return; router.push(ROUTES.shop(shop!.slug)); return }
    // 신규: 여기(등록 완료)서야 비공개 임시 → active로 공개된다
    if (createdShopId) { setSaving(true); await publishShop(createdShopId); setSaving(false) }
    // "이 샵의 사장님입니까?" 물어보고, 네면 바로 인증 신청으로
    setOwnerAsk(true)
  }
  function goShopAfterRegister() {
    router.push(shopSlug ? ROUTES.shop(shopSlug) : '/profile?tab=shops')
  }
  function goClaim() {
    if (shopSlug) router.push(`/shop/claim/${shopSlug}`)
    else router.push('/profile?tab=shops')
  }

  const guide = [
    { label: '샵 이름', ok: !!form.name.trim() },
    { label: '카테고리', ok: form.cats.length > 0 },
    { label: '주소', ok: !!form.addr.trim() },
    { label: '영업시간', ok: !!form.hours && Object.values(form.hours).some(Boolean) },
    { label: '저장', ok: canEnrich },
  ]

  const previewCat = CATEGORIES.find(c => form.cats.includes(c.name))
  const previewStatus = getTodayStatus(form.hours)
  // 대표 사진 — 사진 단계에서 바꾸면 PhotosManage가 알려줘 미리보기에 바로 반영된다
  const [previewImg, setPreviewImg] = useState<string | null>(mode === 'edit' ? (shop?.images?.[0] ?? null) : null)
  // 사진 순서가 저장 안 된 채로 화면을 뜨는 걸 막기 위해 PhotosManage가 알려준다
  const [photosDirty, setPhotosDirty] = useState(false)

  return (
    <div className="sw-root" style={{ maxWidth: 1320, margin: '0 auto', padding: '20px 32px 60px' }}>
      <style>{`.taku-page-2col{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:28px;align-items:start}
      @media (hover:none) and (pointer:coarse) and (max-width:900px){
        .sw-root{ padding: 12px 14px 60px !important; }
        .taku-page-2col{ grid-template-columns:1fr; gap:0 }
        .taku-page-2col > aside{ display:none !important; }           /* 모바일: 샵 미리보기·TIP 숨김 */
        .taku-page-2col > div{ border:none !important; border-radius:0 !important; padding:0 !important; background:transparent !important; }  /* 폼 네모칸 제거 */
      }`}</style>

      {/* 등록 완료 → "이 샵의 사장님입니까?" 모달 */}
      {ownerAsk && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ width: '100%', maxWidth: 420, background: 'var(--surface)', borderRadius: 18, padding: '26px 24px', boxShadow: '0 16px 48px rgba(0,0,0,.28)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center', marginBottom: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 9999, background: 'var(--accent-l, rgba(232,0,111,.1))', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
                <Svg size={24} color="var(--accent)"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M15 9h.01M9 13h.01M15 13h.01M9 17h.01M15 17h.01" /></Svg>
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>이 샵의 사장님이신가요?</h2>
              <p style={{ fontSize: 13.5, color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
                샵 등록이 완료됐어요. 실제 이 매장의 사장님이시라면 바로 사장님 인증을 신청할 수 있어요.
              </p>
            </div>

            {/* 안내 문구 */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 13px', marginBottom: 18 }}>
              <Svg size={16} color="var(--accent)"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></Svg>
              <p style={{ fontSize: 12.5, color: 'var(--text)', margin: 0, lineHeight: 1.55 }}>
                사장님 인증을 받으면 <b>이 매장은 사장님만 수정할 수 있어요.</b> 다른 사람이 임의로 매장 정보를 바꿀 수 없어 정보를 안전하게 지킬 수 있어요.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <button
                onClick={goClaim}
                style={{ width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                네, 사장님 인증 신청할게요
              </button>
              <button
                onClick={goShopAfterRegister}
                style={{ width: '100%', padding: '13px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                아니요, 괜찮아요
              </button>
            </div>
          </div>
        </div>
      )}

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
              <div ref={placeBoxRef} style={{ position: 'relative' }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input value={form.addr ?? ''} onChange={e => { set('addr', e.target.value); set('lat', null); set('lng', null) }}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handlePlaceSearch() } if (e.key === 'Escape') setPlaceResults([]) }}
                    placeholder="예: 수원 스타필드, 서울 마포구 와우산로 21" style={{ ...inp, flex: 1 }} />
                  <button onClick={handlePlaceSearch} disabled={searchingPlace || !form.addr.trim()}
                    style={{ padding: '0 18px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                    {searchingPlace ? '검색중' : '검색'}
                  </button>
                </div>
                {placeResults.length > 0 && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 50, maxHeight: 260, overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.14)' }} role="listbox">
                    {placeResults.map((place, i) => (
                      <div key={i} role="option" aria-selected={false} onClick={() => selectPlace(place)} style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: i < placeResults.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{place.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{place.roadAddress}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {form.lat && form.addr && <p style={{ fontSize: 12, color: 'var(--green)', marginTop: 4 }}><Svg size={12}><path d="m5 12 5 5L20 6" /></Svg> 위치가 설정됐어요</p>}
              {placeLinking && <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>장소 연결 중…</p>}
              {form.place_name && !placeLinking && (
                <p style={{ fontSize: 12, color: 'var(--accent)', marginTop: 4, fontWeight: 700 }}>
                  <Svg size={12}><path d="M9 11a3 3 0 1 0 6 0 3 3 0 0 0-6 0z" /><path d="M17.7 16.7 12 22l-5.7-5.3a8 8 0 1 1 11.4 0z" /></Svg> {form.place_name}에 연결돼요 · 이 장소의 다른 샵·이벤트와 함께 묶여요
                </p>
              )}

              {/* 관리자 학습: 이 주소 = 이 장소 매핑 (등록·편집 모두, 관리자) */}
              {isAdmin && form.addr && (
                <AdminPlaceLink
                  shopAddr={form.addr}
                  currentPlaceName={form.place_name}
                  onLinked={p => setForm(prev => ({ ...prev, place_id: p.id, place_name: p.name }))}
                />
              )}
              {isAdmin && form.place_id && (
                <AdminPlaceAccessNote placeId={form.place_id} placeName={form.place_name} />
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

            {/* 영업시간 편집기는 ShopHoursEditor로 분리했다 —
                사장님 매장 관리(HoursManage)와 같은 걸 쓴다. 표시·동작은 그대로다. */}
            <Field label="영업시간" hint={HOURS_HINT}>
              <ShopHoursEditor value={form.hours} onChange={h => set('hours', h)} />
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
                <>
                  <textarea value={form.parking_note ?? ''} onChange={e => set('parking_note', e.target.value)} rows={4} placeholder={'주차 메모 (줄바꿈으로 여러 줄 입력 가능)\n예)\n무료주차 : 30분\n1~3만원 : 1시간\n3~5만원 : 2시간'} style={{ ...inp, marginTop: 8, minHeight: 96, lineHeight: 1.6, resize: 'vertical', whiteSpace: 'pre-wrap' }} />
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>Enter로 줄을 바꾸면 입력한 그대로 보여져요.</div>
                </>
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
            {canEnrich && shopId && shopSlug
              ? <PhotosManage shop={{ id: shopId, slug: shopSlug }} embedded onCoverChange={setPreviewImg} onDirtyChange={setPhotosDirty} />
              : <NeedSave />}
          </>
        )}

        {/* STEP 3 — 취급 작품 & 상품 */}
        {step === 3 && (
          <>
            <StepHead icon={<Svg size={20} color="var(--accent)"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="M3.3 7 12 12l8.7-5M12 22V12" /></Svg>} title="취급 작품 & 상품" sub="이 샵에서 다루는 작품과 상품을 입력해주세요." />
            {canEnrich && shopId ? (
              <>
                <ShopEnrichmentSection shopId={shopId} />
                <div style={{ height: 1, background: 'var(--border)', margin: '24px 0' }} />
                <ShopEventLinkPanel shopId={shopId} shopName={form.name} shopAddr={form.addr || null} />
              </>
            ) : <NeedSave />}
          </>
        )}

        {/* STEP 4 — 추천 코너 (사진 관리는 2단계) */}
        {step === 4 && (
          <>
            <StepHead icon={<Svg size={20} color="var(--accent)"><path d="m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8 6.2 20.9l1.1-6.5L2.6 9.8l6.5-.9z" /></Svg>} title="추천 코너" sub="“이 샵 가면 이것만큼은 꼭 보세요” — 가본 사람만 아는 포인트를 알려주세요." />
            {canEnrich && shopId && shopSlug ? <ShopHighlightManager shopId={shopId} shopSlug={shopSlug} /> : <NeedSave />}
          </>
        )}

        {/* STEP 5 — 확인 & 등록 */}
        {step === 5 && (
          <>
            <StepHead icon={<Svg size={20} color="var(--accent)"><path d="m5 12 5 5L20 6" /></Svg>} title="마지막으로 확인해요" sub="입력한 정보를 확인하고 등록을 완료해주세요." />
            {shopId && <div style={{ marginBottom: 16 }}><CompletenessIndicator shopId={shopId} /></div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
              <ReviewRow label="샵 이름" value={form.name || '미입력'} ok={!!form.name.trim()} />
              <ReviewRow label="카테고리" value={form.cats.join(', ') || '미선택'} ok={form.cats.length > 0} />
              <ReviewRow label="주소" value={form.addr || '미입력'} ok={!!form.addr.trim()} />
              <ReviewRow label="영업시간" value={form.hours && Object.values(form.hours).some(Boolean) ? '입력됨' : '미입력'} ok={!!form.hours && Object.values(form.hours).some(Boolean)} />
            </div>
            {mode === 'create' && <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>‘등록 완료’를 눌러야 지도에 공개돼요. 그전까지는 저장돼도 비공개(임시)예요.</p>}
          </>
        )}

        {error && (
          <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: 'var(--red-l, #fdecec)', color: 'var(--red, #d33)', fontSize: 13, fontWeight: 700 }}>{error}</div>
        )}

        {/* 단계 이동 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <button onClick={goPrev} disabled={step === 1} style={{ ...ghostBtn, opacity: step === 1 ? 0.4 : 1, display: 'inline-flex', alignItems: 'center', gap: 5 }}><Svg size={15}><path d="m15 18-6-6 6-6" /></Svg>이전</button>
          {step < STEPS.length ? (
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

function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 6 }}>{label}</div>
      {hint && <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8, lineHeight: 1.6 }}>{hint}</p>}
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

const nextBtn: React.CSSProperties = {
  padding: '13px 26px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff',
  fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5,
}