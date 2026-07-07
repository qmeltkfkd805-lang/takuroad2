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
import { geocodeAddress } from '@/lib/utils/geocode'
import ShopEnrichmentSection from './ShopEnrichmentSection'
import ShopEventManager from './ShopEventManager'
import ShopAmenitySection from './ShopAmenitySection'
import ShopHighlightManager from './ShopHighlightManager'
import CompletenessIndicator from './CompletenessIndicator'
import { searchPlace, PlaceSearchResult } from '@/lib/utils/geocode'
import ShopMainImageUploader from './ShopMainImageUploader'
import ShopFormWizard from './ShopFormWizard'
import { useIsDesktop } from '@/hooks/useIsDesktop'

interface Props {
  mode: 'create' | 'edit'
  shop?: Shop
}

const EMPTY_FORM: ShopFormData = {
  name: '', slug: '', description: '', addr: '',
  lat: null, lng: null, cats: [],
  hours: null, parking: null, parking_note: '',
  shop_link: '', floor_info: '', start_date: '', end_date: '', event_info: '', sns_links: [], phone: '',
}

export default function ShopForm({ mode, shop }: Props) {
  const router = useRouter()
  const { user } = useAuth()
  const [form, setForm] = useState<ShopFormData>(EMPTY_FORM)
  const isDesktop = useIsDesktop()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [placeResults, setPlaceResults] = useState<PlaceSearchResult[]>([])
  const [searchingPlace, setSearchingPlace] = useState(false)
  const [createdShopId, setCreatedShopId] = useState<string | null>(null)
  const [createdShopSlug, setCreatedShopSlug] = useState<string | null>(null)

  useEffect(() => {
    if (!user) router.push(ROUTES.login)
  }, [user, router])

  useEffect(() => {
    if (mode === 'edit' && shop) {
      setForm({
        name: shop.name,
        slug: shop.slug,
        description: shop.description ?? '',
        addr: shop.addr ?? '',
        lat: shop.lat,
        lng: shop.lng,
        cats: shop.cats,
        hours: shop.hours,
        parking: shop.parking,
        parking_note: shop.parking_note ?? '',
        shop_link: shop.shop_link ?? '',
        floor_info: shop.floor_info ?? '',
        start_date: shop.start_date ?? '',
        end_date: shop.end_date ?? '',
        event_info: shop.event_info ?? '', sns_links: shop.sns_links ?? [], phone: shop.phone ?? '',
      })
    }
  }, [mode, shop])

  function set(key: keyof ShopFormData, value: any) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function handleNameChange(name: string) {
    set('name', name)
    if (mode === 'create') {
      set('slug', generateSlug(name))
    }
  }

  async function handlePlaceSearch() {
    if (!form.addr.trim()) return
    setSearchingPlace(true)
    const results = await searchPlace(form.addr)
    setPlaceResults(results)
    setSearchingPlace(false)
  }

  function selectPlace(place: PlaceSearchResult) {
    set('addr', place.roadAddress)
    set('lat', place.lat)
    set('lng', place.lng)
    setPlaceResults([])
  }

  async function handleSubmit() {
    if (!user) return
    if (!form.name.trim()) return setError('샵 이름을 입력해주세요')
    if (!form.slug.trim()) return setError('슬러그를 입력해주세요')
    if (form.cats.length === 0) return setError('카테고리를 선택해주세요')

    setSubmitting(true)
    setError('')

    let finalForm = form
    if (form.addr.trim() && !form.lat) {
      const coords = await geocodeAddress(form.addr)
      if (coords) {
        finalForm = { ...form, lat: coords.lat, lng: coords.lng }
        setForm(finalForm)
      }
    }

    if (mode === 'create') {
      const result = await createShop(finalForm, user.id)
      if (!result) {
        setError('등록에 실패했어요. 슬러그가 중복되었을 수 있어요.')
        setSubmitting(false)
        return
      }
      setCreatedShopId(result.id)
      setCreatedShopSlug(result.slug)
      setSubmitting(false)
    } else if (shop) {
      const ok = await updateShop(shop.id, finalForm, user.id)
      if (!ok) {
        setError('수정에 실패했어요.')
        setSubmitting(false)
        return
      }
      router.push(ROUTES.shop(shop.slug))
    }
  }

  const enrichmentShopId = mode === 'edit' ? shop?.id : createdShopId

  if (isDesktop) return <ShopFormWizard mode={mode} shop={shop} />

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '0 0 80px' }}>
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px',
      }}>
        <button onClick={() => router.back()} style={{
          background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer',
        }}>←</button>
        <h1 style={{ fontSize: '16px', fontWeight: 900 }}>
          {mode === 'create' ? '샵 등록' : '샵 수정'}
        </h1>
      </div>

      <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {mode === 'edit' && shop && (
          <>
            <CompletenessIndicator shopId={shop.id} />
            <ShopMainImageUploader
              shopSlug={shop.slug}
              shopId={shop.id}
              currentImageUrl={shop.images[0] ?? null}
            />
          </>
        )}

        {createdShopId ? (
          <div style={{
            padding: '14px', borderRadius: '10px',
            background: 'var(--green-l)', color: 'var(--green)',
            fontWeight: 700, fontSize: '14px', textAlign: 'center',
          }}>
            ✓ 샵이 등록됐어요! 아래에서 취급 작품과 굿즈를 이어서 입력해보세요.
          </div>
        ) : (
          <>
            <Field label="샵 이름 *">
              <input
                type="text"
                value={form.name}
                onChange={e => handleNameChange(e.target.value)}
                placeholder="예: 애니메이트 홍대"
                style={inputStyle}
              />
            </Field>

            <Field label="슬러그 *" hint="URL에 사용되는 영문 주소예요. 자동으로 채워지지만 직접 수정할 수 있어요 (예: animate-hongdae)">
              <input
                type="text"
                value={form.slug}
                onChange={e => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="animate-hongdae"
                style={inputStyle}
              />
              {form.slug && (
                <p style={{ fontSize: '12px', color: 'var(--muted)' }}>
                  🔗 페이지 주소: /shop/{form.slug}
                </p>
              )}
            </Field>

            <Field label="카테고리 *" hint="이 가게의 성격을 선택해주세요 (복수 선택 가능)">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px' }}>
                {CATEGORIES.map(cat => {
                  const selected = form.cats.includes(cat.name)
                  return (
                    <button
                      key={cat.slug}
                      onClick={() => setForm(prev => ({
                        ...prev,
                        cats: selected
                          ? prev.cats.filter(c => c !== cat.name)
                          : [...prev.cats, cat.name],
                      }))}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                        padding: '16px 10px', borderRadius: '14px', cursor: 'pointer',
                        border: `2px solid ${selected ? cat.color : 'var(--border)'}`,
                        background: selected ? cat.bgColor : 'var(--surface)',
                        fontFamily: 'inherit', textAlign: 'center',
                      }}
                    >
                      <div style={{
                        width: '40px', height: '40px', borderRadius: '50%',
                        background: cat.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '20px',
                      }}>
                        {cat.icon}
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: 900, color: selected ? cat.color : 'var(--text)' }}>
                        {cat.name}
                      </span>
                    </button>
                  )
                })}
              </div>
            </Field>

            <Field label="주소" hint="장소명(예: 수원 스타필드)이나 주소를 입력하고 검색해주세요">
  <div style={{ display: 'flex', gap: '6px' }}>
    <input
      type="text"
      value={form.addr}
      onChange={e => { set('addr', e.target.value); set('lat', null); set('lng', null) }}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handlePlaceSearch() } }}
      placeholder="예: 수원 스타필드, 서울 마포구 와우산로 21"
      style={{ ...inputStyle, flex: 1 }}
    />
    <button
      onClick={handlePlaceSearch}
      disabled={searchingPlace || !form.addr.trim()}
      style={{
        padding: '0 16px', borderRadius: '10px', border: 'none',
        background: 'var(--accent)', color: '#fff', fontWeight: 700,
        fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
      }}
    >
      {searchingPlace ? '검색중' : '검색'}
    </button>
  </div>

  {placeResults.length > 0 && (
    <div style={{
      marginTop: '8px', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden',
    }}>
      {placeResults.map((place, i) => (
        <div
          key={i}
          onClick={() => selectPlace(place)}
          style={{
            padding: '10px 12px', cursor: 'pointer',
            borderBottom: i < placeResults.length - 1 ? '1px solid var(--border)' : 'none',
          }}
        >
          <div style={{ fontSize: '13px', fontWeight: 700 }}>{place.name}</div>
          <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{place.roadAddress}</div>
        </div>
      ))}
    </div>
  )}

  {form.lat && form.addr && (
    <p style={{ fontSize: '12px', color: 'var(--green)', marginTop: '4px' }}>
      ✓ 위치가 설정됐어요
    </p>
  )}
</Field>

<Field label="상세 위치" hint="건물 내 층수 등 자세한 위치를 입력해주세요">
  <input
    type="text"
    value={form.floor_info}
    onChange={e => set('floor_info', e.target.value)}
    placeholder="예: 5층, 지하 1층 B구역"
    style={inputStyle}
  />
</Field>

            <Field label="영업시간" hint="요일별로 입력해주세요. 비워두면 정보 없음으로 표시돼요">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {WEEKDAYS.map(day => {
                  const dayHours = form.hours?.[day]
                  const isOpen = !!dayHours

                  return (
                    <div key={day} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        onClick={() => {
                          const newHours: BusinessHours = { ...(form.hours ?? {}) }
                          if (isOpen) {
                            newHours[day] = null
                          } else {
                            newHours[day] = { open: '10:00', close: '20:00' }
                          }
                          set('hours', newHours)
                        }}
                        style={{
                          width: '32px', flexShrink: 0, padding: '6px 0', borderRadius: '6px',
                          border: `1.5px solid ${isOpen ? 'var(--accent)' : 'var(--border)'}`,
                          background: isOpen ? 'var(--accent-l)' : 'var(--surface)',
                          color: isOpen ? 'var(--accent)' : 'var(--muted)',
                          fontWeight: 700, fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        {WEEKDAY_LABEL[day]}
                      </button>

                      {isOpen ? (
                        <>
                          <input
                            type="time"
                            value={dayHours.open}
                            onChange={e => {
                              const newHours: BusinessHours = { ...(form.hours ?? {}) }
                              newHours[day] = { ...dayHours, open: e.target.value }
                              set('hours', newHours)
                            }}
                            style={{ ...inputStyle, padding: '6px 8px', fontSize: '13px' }}
                          />
                          <span style={{ color: 'var(--muted)' }}>~</span>
                          <input
                            type="time"
                            value={dayHours.close}
                            onChange={e => {
                              const newHours: BusinessHours = { ...(form.hours ?? {}) }
                              newHours[day] = { ...dayHours, close: e.target.value }
                              set('hours', newHours)
                            }}
                            style={{ ...inputStyle, padding: '6px 8px', fontSize: '13px' }}
                          />
                        </>
                      ) : (
                        <span style={{ fontSize: '13px', color: 'var(--muted)' }}>휴무</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </Field>

            <Field label="소개">
              <textarea
                value={form.description}
                onChange={e => set('description', e.target.value)}
                placeholder="샵에 대한 간단한 소개를 입력해주세요"
                rows={4}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </Field>

            <Field label="공식 링크">
              <input
                type="url"
                value={form.shop_link}
                onChange={e => set('shop_link', e.target.value)}
                placeholder="https://..."
                style={inputStyle}
              />
            </Field>

            <Field label="주차">
              <div style={{ display: 'flex', gap: '8px' }}>
                {[
                  { label: '모름', value: null },
                  { label: '가능', value: true },
                  { label: '불가', value: false },
                ].map(opt => (
                  <button
                    key={String(opt.value)}
                    onClick={() => set('parking', opt.value)}
                    style={{
                      padding: '8px 16px', borderRadius: '8px', cursor: 'pointer',
                      border: `1.5px solid ${form.parking === opt.value ? 'var(--accent)' : 'var(--border)'}`,
                      background: form.parking === opt.value ? 'var(--accent-l)' : 'var(--surface)',
                      color: form.parking === opt.value ? 'var(--accent)' : 'var(--text)',
                      fontWeight: 700, fontSize: '13px', fontFamily: 'inherit',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {form.parking !== null && (
                <input
                  type="text"
                  value={form.parking_note}
                  onChange={e => set('parking_note', e.target.value)}
                  placeholder="주차 관련 메모 (예: 건물 내 2시간 무료)"
                  style={{ ...inputStyle, marginTop: '8px' }}
                />
              )}
            </Field>

            <Field label="팝업 기간" hint="팝업스토어인 경우에만 입력해주세요">
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={e => set('start_date', e.target.value)}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <span style={{ color: 'var(--muted)' }}>~</span>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={e => set('end_date', e.target.value)}
                  style={{ ...inputStyle, flex: 1 }}
                />
              </div>
            </Field>

            {(form.start_date || form.end_date) && (
              <Field label="팝업 이벤트 내용">
                <textarea
                  value={form.event_info}
                  onChange={e => set('event_info', e.target.value)}
                  placeholder="이벤트 내용을 입력해주세요"
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </Field>
            )}

            {error && (
              <div style={{
                padding: '12px', borderRadius: '8px',
                background: 'var(--red-l)', color: 'var(--red)',
                fontSize: '13px', fontWeight: 700,
              }}>
                {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                width: '100%', padding: '14px', borderRadius: '12px',
                background: submitting ? 'var(--border)' : 'var(--accent)',
                color: '#fff', border: 'none',
                fontWeight: 900, fontSize: '16px',
                cursor: submitting ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {submitting ? '처리 중...' : mode === 'create' ? '등록 완료' : '수정 완료'}
            </button>

            {mode === 'create' && (
              <p style={{ fontSize: '12px', color: 'var(--muted)', textAlign: 'center', marginTop: '-12px' }}>
                등록 후 관리자 승인 후 지도에 표시돼요.
              </p>
            )}
          </>
        )}

        {enrichmentShopId && (
          <>
            <div style={{ height: '1px', background: 'var(--border)', margin: '8px 0' }} />
            <ShopEnrichmentSection shopId={enrichmentShopId} />

            <div style={{ height: '1px', background: 'var(--border)', margin: '8px 0' }} />
            <h3 style={{ fontSize: '14px', fontWeight: 900 }}>🎉 이벤트 / 공지</h3>
            <ShopEventManager shopId={enrichmentShopId} shopSlug={mode === 'edit' ? shop!.slug : createdShopSlug!} />

            <div style={{ height: '1px', background: 'var(--border)', margin: '8px 0' }} />
            <h3 style={{ fontSize: '14px', fontWeight: 900 }}>🚗 편의시설 / 서비스</h3>
            <ShopAmenitySection shopId={enrichmentShopId} />

            <div style={{ height: '1px', background: 'var(--border)', margin: '8px 0' }} />
            <h3 style={{ fontSize: '14px', fontWeight: 900 }}>🌟 추천 코너</h3>
            <ShopHighlightManager shopId={enrichmentShopId} shopSlug={mode === 'edit' ? shop!.slug : createdShopSlug!} />
            
            {createdShopId && createdShopSlug && (
              <button
                onClick={() => router.push('/profile?tab=shops')}
                style={{
                  width: '100%', padding: '12px', borderRadius: '10px',
                  border: '1px solid var(--border)', background: 'var(--surface)',
                  fontWeight: 700, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                완료, 샵 페이지로 이동
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Field({ label, hint, children }: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label style={{ fontSize: '13px', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
        {label}
      </label>
      {hint && (
        <p style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '6px' }}>{hint}</p>
      )}
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 12px',
  border: '1.5px solid var(--border)', borderRadius: '10px',
  fontSize: '14px', fontFamily: 'inherit',
  background: 'var(--surface2)', color: 'var(--text)',
  outline: 'none', boxSizing: 'border-box',
}