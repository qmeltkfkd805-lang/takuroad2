'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { getAllTagsForSelect } from '@/services/routeService'
import { getActiveWorks } from '@/services/activeWorksService'
import { searchPlace, PlaceSearchResult } from '@/lib/utils/geocode'
import { findPlaceByAddr } from '@/services/placeService'
import { getEventStatus } from '@/lib/utils/eventStatus'
import { daysUntil } from '@/lib/event/rankEvents'
import {
  EventFormData, EMPTY_EVENT_FORM,
  createEventDraft, updateEventDraft, saveEventExtra, searchShopsByName, loadEventForm, uploadEventCover,
} from '@/services/eventCreateService'
import { getShopBySlug } from '@/services/shopService'
import { EventHomeType } from '@/services/eventHomeService'
import { TYPE_LABEL } from './EventFilterBar'
import { EventIcon, EventIconName } from './EventIcon'
import EventGoodsTab from './EventGoodsTab'
import EventHoursEditor from './EventHoursEditor'
import { summarizeHours } from '@/lib/event/eventHours'

const STEPS = [
  { n: 1, label: '작품 & 종류' },
  { n: 2, label: '기본 정보' },
  { n: 3, label: '장소' },
  { n: 4, label: '상세 정보' },
  { n: 5, label: '메뉴 & 굿즈' },
  { n: 6, label: '확인 & 등록' },
]

const TIPS = [
  '작품을 연결해야 그 작품 팬들에게 노출돼요.',
  '제목은 "작품명 + 이벤트명"이 가장 잘 읽혀요.',
  '등록된 샵에 연결하면 지도·길찾기·평점이 함께 붙어요.',
  '운영 시간과 입장 방법은 사람들이 가장 많이 확인하는 정보예요.',
  '굿즈는 사진만 올려도 괜찮아요. 다른 사람이 이름을 채워줄 수 있어요.',
  '등록 후에도 언제든 수정할 수 있어요.',
]

type Tag = { id: string; name: string; slug: string }
type ShopHit = { id: string; name: string; addr: string | null }

export default function EventFormWizard({ editId }: { editId?: string }) {
  const router = useRouter()
  const params = useSearchParams()
  const { user, loading: authLoading } = useAuth()
  const isEdit = !!editId

  const [form, setForm] = useState<EventFormData>(EMPTY_EVENT_FORM)
  const [step, setStep] = useState(1)
  const [eventId, setEventId] = useState<string | null>(editId ?? null)
  const [loadingEvent, setLoadingEvent] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [tags, setTags] = useState<Tag[]>([])
  const [tagQuery, setTagQuery] = useState('')
  const [shopQuery, setShopQuery] = useState('')
  const [shopHits, setShopHits] = useState<ShopHit[]>([])
  const [shopPicked, setShopPicked] = useState<ShopHit | null>(null)
  const [placeQuery, setPlaceQuery] = useState('')
  const [placeHits, setPlaceHits] = useState<PlaceSearchResult[]>([])
  const [placeSearching, setPlaceSearching] = useState(false)

  const set = <K extends keyof EventFormData>(k: K, v: EventFormData[K]) =>
    setForm(f => ({ ...f, [k]: v }))

  // 작품은 인기순(최근 7일 검색·최애·관심 합산 = get_active_works)으로.
  // 인기 목록에 없는 작품은 뒤에 가나다순으로 붙는다.
  useEffect(() => {
    Promise.all([getAllTagsForSelect(), getActiveWorks(50).catch(() => [])])
      .then(([all, hot]) => {
        const rank = new Map(hot.map((w, i) => [w.id, i]))
        setTags([...all].sort((a, b) =>
          (rank.get(a.id) ?? 9999) - (rank.get(b.id) ?? 9999) || a.name.localeCompare(b.name, 'ko'),
        ))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!authLoading && !user) router.push(`/login?redirect=${isEdit ? `/event/${editId}/edit` : '/event/new'}`)
  }, [authLoading, user, router, isEdit, editId])

  // 등록 모드 — 작품 홈(?tag=)이나 샵 상세(?shop=)에서 넘어왔으면 미리 채운다
  useEffect(() => {
    if (isEdit) return

    const tagId = params?.get('tag')
    if (tagId) setForm(f => ({ ...f, tagId }))

    const shopSlug = params?.get('shop')
    if (!shopSlug) return
    getShopBySlug(shopSlug)
      .then(shop => {
        if (!shop) return
        setForm(f => ({
          ...f,
          shopId: shop.id,
          placeName: shop.name,
          placeAddr: shop.addr ?? '',
          placeLat: shop.lat != null ? Number(shop.lat) : null,
          placeLng: shop.lng != null ? Number(shop.lng) : null,
        }))
        setShopPicked({ id: shop.id, name: shop.name, addr: shop.addr ?? null })
      })
      .catch(() => {})
    // 최초 1회만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit])

  // 수정 모드 — 기존 값을 채우고, 작성자/관리자가 아니면 되돌려보낸다
  useEffect(() => {
    if (!isEdit || !editId || !user) return
    loadEventForm(editId)
      .then(res => {
        if (!res) { router.push('/events'); return }
        // 위키 방식 — 로그인한 사람은 누구나 고칠 수 있다 (삭제만 작성자)
        setForm(res.form)
        if (res.form.shopId) {
          setShopPicked({ id: res.form.shopId, name: res.form.placeName, addr: res.form.placeAddr || null })
        }
        setLoadingEvent(false)
      })
      .catch(() => router.push('/events'))
  }, [isEdit, editId, user, router])

  // 샵 검색 (디바운스)
  useEffect(() => {
    if (!shopQuery.trim()) { setShopHits([]); return }
    const t = setTimeout(() => { searchShopsByName(shopQuery).then(setShopHits).catch(() => {}) }, 250)
    return () => clearTimeout(t)
  }, [shopQuery])

  // 카카오 장소 검색 (디바운스)
  useEffect(() => {
    if (!placeQuery.trim()) { setPlaceHits([]); return }
    setPlaceSearching(true)
    const t = setTimeout(() => {
      searchPlace(placeQuery)
        .then(setPlaceHits)
        .catch(() => setPlaceHits([]))
        .finally(() => setPlaceSearching(false))
    }, 300)
    return () => clearTimeout(t)
  }, [placeQuery])

  const selectedTag = tags.find(t => t.id === form.tagId) ?? null
  const filteredTags = useMemo(() => {
    const q = tagQuery.trim().toLowerCase()
    const list = q ? tags.filter(t => t.name.toLowerCase().includes(q)) : tags
    return list.slice(0, 12)
  }, [tags, tagQuery])

  // 단계별 통과 조건
  const canPass: Record<number, boolean> = {
    1: !!form.tagId,
    2: form.title.trim().length > 0 && !!form.startDate && !!form.endDate && form.startDate <= form.endDate
       && !(form.reserveStart && form.reserveEnd && form.reserveStart > form.reserveEnd),
    3: !!form.shopId || form.placeName.trim().length > 0,
    4: true,
    5: true,
    6: true,
  }

  const next = async () => {
    setError('')
    if (!canPass[step]) { setError('필수 항목을 채워주세요.'); return }
    if (!user) return

    // 2단계에서 events 행을 만들고, 이후 단계는 그 id에 붙는다 (등록 모드만)
    if (step === 2 && !eventId) {
      setSaving(true)
      const res = await createEventDraft(form, user.id)
      setSaving(false)
      if (!res.id) { setError(`저장 실패: ${res.message ?? '알 수 없는 오류'}`); return }
      setEventId(res.id)
      setStep(3)
      return
    }

    // 수정 모드에서는 2단계에서도 곧바로 갱신한다
    if (eventId && (step === 2 || step === 3 || step === 4)) {
      setSaving(true)
      const a = await updateEventDraft(eventId, form)
      const b = await saveEventExtra(eventId, form, user.id)
      setSaving(false)
      if (!a.ok || !b.ok) { setError(`저장 실패: ${a.message ?? b.message}`); return }
    }

    setStep(s => Math.min(6, s + 1))
  }

  const finish = async () => {
    if (!eventId || !user) return
    setSaving(true)
    const a = await updateEventDraft(eventId, form)
    const b = await saveEventExtra(eventId, form, user.id)
    setSaving(false)
    if (!a.ok || !b.ok) { setError(`저장 실패: ${a.message ?? b.message}`); return }
    router.push(`/event/${eventId}`)
  }

  const pickShop = (s: ShopHit) => {
    setShopPicked(s)
    set('shopId', s.id)
    set('placeName', s.name)
    setShopHits([])
    setShopQuery('')
  }
  const clearShop = () => {
    setShopPicked(null)
    set('shopId', null)
    set('placeId', null)
    set('placeName', '')
    set('placeAddr', '')
    set('placeLat', null)
    set('placeLng', null)
  }

  const pickPlace = async (p: PlaceSearchResult) => {
    set('placeName', p.name)
    set('placeAddr', p.roadAddress || p.address)
    set('placeLat', p.lat)
    set('placeLng', p.lng)
    setPlaceHits([])
    setPlaceQuery('')
    // 이 주소가 학습된 장소면 자동 연결 (지도 그룹핀·place 상세에 묶임)
    const matched = await findPlaceByAddr(p.roadAddress || p.address)
    set('placeId', matched ? matched.id : null)
  }
  const clearPlace = () => {
    set('placeId', null)
    set('placeName', '')
    set('placeAddr', '')
    set('placeLat', null)
    set('placeLng', null)
  }

  if (authLoading || !user || loadingEvent) return null

  return (
    <div style={{ maxWidth: 1320, margin: '0 auto', padding: '20px 32px 60px' }}>
      <style>{`.taku-page-2col{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:28px;align-items:start}@media (hover:none) and (pointer:coarse) and (max-width:900px){.taku-page-2col{grid-template-columns:1fr}}`}</style>

      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => router.back()} style={iconBtn} aria-label="뒤로">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0 }}>{isEdit ? '이벤트 수정' : '이벤트 등록'}</h1>
        </div>
        <button onClick={() => router.back()} style={ghostBtn}>나가기</button>
      </div>

      {/* 스텝바 */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 28, paddingBottom: 6 }}>
        {STEPS.map(s => {
          const active = step === s.n
          const done = step > s.n
          const reachable = isEdit || s.n <= step || (s.n <= 2) || !!eventId
          return (
            <button key={s.n} onClick={() => reachable && setStep(s.n)} disabled={!reachable}
              style={{ flex: '1 0 auto', display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px', border: 'none', background: 'none', cursor: reachable ? 'pointer' : 'default', fontFamily: 'inherit', opacity: reachable ? 1 : .5, borderBottom: `3px solid ${active ? 'var(--accent)' : 'transparent'}` }}>
              <span style={{ width: 28, height: 28, borderRadius: 9999, flexShrink: 0, fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', background: active || done ? 'var(--accent)' : 'var(--surface2)', color: active || done ? '#fff' : 'var(--muted)' }}>
                {done ? <CheckIcon /> : s.n}
              </span>
              <span style={{ fontSize: 15, fontWeight: active ? 800 : 600, color: active ? 'var(--text)' : 'var(--muted)', whiteSpace: 'nowrap' }}>{s.label}</span>
            </button>
          )
        })}
      </div>

      <div className="taku-page-2col">
        {/* ── 폼 카드 ── */}
        <div style={{ border: '1px solid var(--border)', borderRadius: 18, padding: 32, background: 'var(--surface)' }}>

          {step === 1 && (
            <>
              <StepHead icon="work" title="어떤 작품의 이벤트인가요?" sub="작품을 연결해야 그 작품 팬들에게 노출돼요." />
              <Field label="작품 *">
                {selectedTag ? (
                  <div style={picked}>
                    <span style={{ fontWeight: 800 }}>{selectedTag.name}</span>
                    <button onClick={() => set('tagId', null)} style={linkBtn}>변경</button>
                  </div>
                ) : (
                  <>
                    <input value={tagQuery} onChange={e => setTagQuery(e.target.value)} placeholder="작품 이름으로 검색" style={inp} />
                    {!tagQuery.trim() && <p style={{ ...muted, marginTop: 8 }}>요즘 인기 있는 작품부터 보여드려요.</p>}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 10 }}>
                      {filteredTags.map(t => (
                        <button key={t.id} onClick={() => set('tagId', t.id)} style={chip(false)}>{t.name}</button>
                      ))}
                      {filteredTags.length === 0 && <p style={muted}>일치하는 작품이 없어요.</p>}
                    </div>
                  </>
                )}
              </Field>

              <Field label="이벤트 종류 *">
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {(Object.keys(TYPE_LABEL) as EventHomeType[]).map(t => (
                    <button key={t} onClick={() => set('type', t)} style={chip(form.type === t)}>{TYPE_LABEL[t]}</button>
                  ))}
                </div>
              </Field>
            </>
          )}

          {step === 2 && (
            <>
              <StepHead icon="calendar" title="기본 정보를 입력해주세요" sub="다음을 누르면 이벤트가 저장돼요." />
              <Field label="제목 *" hint="예: 스파이 패밀리 카페 in 수원 스타필드">
                <input value={form.title} onChange={e => set('title', e.target.value)} maxLength={120} placeholder="이벤트 제목" style={inp} />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Field label="시작일 *">
                  <input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} style={inp} />
                </Field>
                <Field label="종료일 *">
                  <input type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)} style={inp} />
                </Field>
              </div>
              {form.startDate && form.endDate && form.startDate > form.endDate && (
                <p style={{ ...muted, color: '#E14B4B' }}>종료일이 시작일보다 빠를 수 없어요.</p>
              )}

              <Field label="메인 이미지" hint="포스터나 대표 사진. 안 올리면 작품 커버가 대신 쓰여요.">
                <CoverUploader value={form.coverUrl} onChange={v => set('coverUrl', v)} />
              </Field>

              <Field label="주차">
                <div style={{ display: 'flex', gap: 8 }}>
                  {([{ label: '모름', v: null }, { label: '가능', v: true }, { label: '불가', v: false }] as const).map(opt => (
                    <button key={String(opt.v)} onClick={() => set('parking', opt.v)} style={chip(form.parking === opt.v)}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                {form.parking !== null && (
                  <input
                    value={form.parkingNote ?? ''}
                    onChange={e => set('parkingNote', e.target.value)}
                    maxLength={60}
                    placeholder={form.parking ? '예: 건물 주차장 2시간 무료, 이후 10분당 500원' : '예: 인근 공영주차장 이용'}
                    style={{ ...inp, marginTop: 8 }}
                  />
                )}
              </Field>

              <div style={{ borderTop: '1px solid var(--border)', margin: '10px 0 22px' }} />

              <Field label="사전예약 기간" hint="예약제 팝업·굿즈 예약이 있으면 적어주세요. 없으면 비워두면 돼요.">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <input type="date" value={form.reserveStart} onChange={e => set('reserveStart', e.target.value)} style={inp} />
                  <input type="date" value={form.reserveEnd} onChange={e => set('reserveEnd', e.target.value)} style={inp} />
                </div>
                {form.reserveStart && form.reserveEnd && form.reserveStart > form.reserveEnd && (
                  <p style={{ ...muted, color: '#E14B4B', marginTop: 8 }}>예약 종료일이 시작일보다 빠를 수 없어요.</p>
                )}
              </Field>
            </>
          )}

          {step === 3 && (
            <>
              <StepHead icon="pin" title="어디에서 열리나요?" sub="등록된 샵에 연결하면 지도·길찾기·평점이 함께 붙어요." />

              <Field label="샵 검색">
                {shopPicked ? (
                  <div style={picked}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800 }}>{shopPicked.name}</div>
                      {shopPicked.addr && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{shopPicked.addr}</div>}
                    </div>
                    <button onClick={clearShop} style={linkBtn}>연결 해제</button>
                  </div>
                ) : (
                  <>
                    <input value={shopQuery} onChange={e => setShopQuery(e.target.value)} placeholder="샵 이름으로 검색 (예: 애니메이트)" style={inp} />
                    {shopHits.length > 0 && (
                      <div style={{ marginTop: 8, border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                        {shopHits.map(s => (
                          <button key={s.id} onClick={() => pickShop(s)} style={hitRow}>
                            <span style={{ fontWeight: 700 }}>{s.name}</span>
                            {s.addr && <span style={{ fontSize: 12, color: 'var(--muted)' }}>{s.addr}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </Field>

              {!shopPicked && (
                <Field label="장소 검색 *" hint="등록된 샵이 없으면 여기서 찾아주세요. 좌표가 저장돼 길찾기가 동작해요.">
                  {form.placeName ? (
                    <div style={picked}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 800 }}>{form.placeName}</div>
                        {form.placeAddr && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{form.placeAddr}</div>}
                      </div>
                      <button onClick={clearPlace} style={linkBtn}>다시 찾기</button>
                    </div>
                  ) : (
                    <>
                      <input value={placeQuery} onChange={e => setPlaceQuery(e.target.value)} placeholder="장소 이름으로 검색 (예: 스타필드 수원)" style={inp} />
                      {placeSearching && <p style={{ ...muted, marginTop: 8 }}>찾는 중…</p>}
                      {placeHits.length > 0 && (
                        <div style={{ marginTop: 8, border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                          {placeHits.map(p => (
                            <button key={`${p.name}-${p.lat}-${p.lng}`} onClick={() => pickPlace(p)} style={hitRow}>
                              <span style={{ fontWeight: 700 }}>{p.name}</span>
                              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{p.roadAddress || p.address}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {!placeSearching && placeQuery.trim() && placeHits.length === 0 && (
                        <p style={{ ...muted, marginTop: 8 }}>검색 결과가 없어요. 다른 이름으로 찾아보세요.</p>
                      )}
                    </>
                  )}
                </Field>
              )}

              <Field label="상세 위치" hint="층·매장 위치처럼 찾아가는 데 필요한 정보">
                <input value={form.placeDetail} onChange={e => set('placeDetail', e.target.value)} maxLength={60} placeholder="예: 4층 팝마트 매장 내" style={inp} />
              </Field>
            </>
          )}

          {step === 4 && (
            <>
              <StepHead icon="clock" title="상세 정보를 채워주세요" sub="사람들이 가장 많이 확인하는 정보예요. 전부 선택 사항이에요." />
              <Field label="운영 시간" hint="요일별로 입력해주세요. 비운 요일은 휴무로 표시돼요.">
                <EventHoursEditor value={form.hours} onChange={v => set('hours', v)} />
              </Field>

              <Field label="추가 안내" hint="표로 표현되지 않는 정보만 적어주세요.">
                <input value={form.hoursInfo} onChange={e => set('hoursInfo', e.target.value)} maxLength={80} placeholder="예: 라스트 오더 21:00" style={inp} />
              </Field>
              <Field label="입장 방법">
                <input value={form.entryInfo} onChange={e => set('entryInfo', e.target.value)} maxLength={80} placeholder="예: 자유 입장 (예약 불필요)" style={inp} />
              </Field>
              <Field label="이벤트 소개">
                <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={5} maxLength={1000} placeholder="어떤 이벤트인지, 뭘 볼 수 있는지 적어주세요." style={{ ...inp, resize: 'vertical' }} />
                <div style={{ textAlign: 'right', fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>{form.description.length}/1000</div>
              </Field>
              <LinkList
                label="공식 사이트 & SNS"
                hint="공식 공지·인스타그램·X 주소. 여러 개 넣을 수 있어요."
                links={form.sourceUrls ?? ['']}
                onChange={v => set('sourceUrls', v)}
              />

              <LinkList
                label="예매·예약 링크"
                hint="예매 페이지가 있으면 넣어주세요. 상세 화면에 '예매하러 가기' 버튼이 생겨요."
                links={form.ticketUrls ?? ['']}
                onChange={v => set('ticketUrls', v)}
              />
            </>
          )}

          {step === 5 && (
            <>
              <StepHead icon="bag" title="메뉴와 굿즈를 등록해주세요" sub="사진만 올려도 괜찮아요. 나중에 다른 사람이 이름을 채워줄 수 있어요." />
              {eventId
                ? <EventGoodsTab eventId={eventId} />
                : <p style={muted}>먼저 2단계 기본 정보를 저장해주세요.</p>}
            </>
          )}

          {step === 6 && (
            <>
              <StepHead icon="sparkle" title="입력한 내용을 확인해주세요" sub={isEdit ? '저장하면 곧바로 반영돼요.' : '등록 후에도 언제든 수정할 수 있어요.'} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <ReviewRow label="작품" value={selectedTag?.name ?? '-'} ok={!!form.tagId} />
                <ReviewRow label="종류" value={TYPE_LABEL[form.type]} ok />
                <ReviewRow label="제목" value={form.title || '-'} ok={!!form.title.trim()} />
                <ReviewRow label="기간" value={form.startDate && form.endDate ? `${form.startDate} ~ ${form.endDate}` : '-'} ok={!!form.startDate && !!form.endDate} />
                <ReviewRow label="사전예약" value={form.reserveStart && form.reserveEnd ? `${form.reserveStart} ~ ${form.reserveEnd}` : '없음'} ok={!!form.reserveStart} />
                <ReviewRow label="메인 이미지" value={form.coverUrl ? '등록됨' : '작품 커버 사용'} ok={!!form.coverUrl} />
                <ReviewRow label="주차" value={form.parking === null ? '모름' : `${form.parking ? '가능' : '불가'}${form.parkingNote ? ` · ${form.parkingNote}` : ''}`} ok={form.parking !== null} />
                <ReviewRow label="장소" value={form.placeName || '-'} ok={!!form.shopId || !!form.placeName.trim()} />
                <ReviewRow label="상세 위치" value={form.placeDetail || '미입력'} ok={!!form.placeDetail} />
                <ReviewRow label="운영 시간" value={summarizeHours(form.hours) ?? '미입력'} ok={!!summarizeHours(form.hours)} />
                <ReviewRow label="추가 안내" value={form.hoursInfo || '미입력'} ok={!!form.hoursInfo} />
                <ReviewRow label="입장 방법" value={form.entryInfo || '미입력'} ok={!!form.entryInfo} />
                <ReviewRow label="소개" value={form.description ? `${form.description.slice(0, 24)}…` : '미입력'} ok={!!form.description} />
                <ReviewRow label="공식 사이트" value={linkCount(form.sourceUrls)} ok={(form.sourceUrls ?? []).some(s => s.trim())} />
                <ReviewRow label="예매 링크" value={linkCount(form.ticketUrls)} ok={(form.ticketUrls ?? []).some(s => s.trim())} />
              </div>
            </>
          )}

          {error && <p style={{ color: '#E14B4B', fontSize: 13, fontWeight: 700, marginTop: 18 }}>{error}</p>}

          {/* 네비 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 30 }}>
            <button onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1} style={{ ...ghostBtn, opacity: step === 1 ? .4 : 1 }}>이전</button>
            {step < 6 ? (
              <button onClick={next} disabled={saving || !canPass[step]} style={{ ...primaryBtn, opacity: saving || !canPass[step] ? .5 : 1 }}>
                {saving ? '저장 중…' : '다음'}
              </button>
            ) : (
              <button onClick={finish} disabled={saving} style={{ ...primaryBtn, opacity: saving ? .5 : 1 }}>
                {saving ? '저장 중…' : isEdit ? '수정 완료' : '이벤트 등록'}
              </button>
            )}
          </div>
        </div>

        {/* ── 미리보기 + TIP ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ border: '1px solid var(--border)', borderRadius: 18, overflow: 'hidden', background: 'var(--surface)' }}>
            <div style={{ padding: '12px 16px', fontSize: 12.5, fontWeight: 800, color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>미리보기</div>
            <div style={{ padding: 12 }}>
              <div style={{ borderRadius: 14, overflow: 'hidden' }}>
                <Preview form={form} tagName={selectedTag?.name ?? null} />
              </div>
            </div>
          </div>

          <div style={{ border: '1px solid var(--border)', borderRadius: 18, padding: 18, background: 'var(--surface2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 900, color: 'var(--accent)', marginBottom: 8 }}>
              <EventIcon name="sparkle" size={15} />TIP
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text)', margin: 0 }}>{TIPS[step - 1]}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function Preview({ form, tagName }: { form: EventFormData; tagName: string | null }) {
  const status = form.startDate && form.endDate
    ? getEventStatus({ startDate: form.startDate, endDate: form.endDate })
    : null
  const dLeft = form.endDate ? daysUntil(form.endDate) : null

  const today = new Date().toISOString().slice(0, 10)
  const reserveOpen = !!form.reserveStart && !!form.reserveEnd
    && form.reserveStart <= today && today <= form.reserveEnd

  const fmt = (s: string) => (s ? s.replaceAll('-', '.') : '')

  // 상세 히어로와 같은 구조: 사진이 전체를 덮고 그 위에 스크림 + 텍스트
  const hasPhoto = !!form.coverUrl
  const fg = hasPhoto ? '#fff' : 'var(--text)'

  return (
    <div style={{
      position: 'relative', overflow: 'hidden', minHeight: hasPhoto ? 0 : 190,
      background: hasPhoto ? '#2A2A32' : 'linear-gradient(120deg,#FFE7F0 0%,#FFF0F5 48%,#FDF3FF 100%)',
    }}>
      {/* 사진이 있으면 높이는 사진 비율이 정한다 */}
      {hasPhoto && (
        <img src={form.coverUrl!} alt="" style={{ display: 'block', width: '100%', height: 'auto', maxHeight: 320, objectFit: 'cover' }} />
      )}

      <div style={{
        position: hasPhoto ? 'absolute' : 'relative',
        left: 0, right: 0, bottom: 0,
        padding: hasPhoto ? '40px 16px 16px' : 16,
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
        background: hasPhoto
          ? 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,.42) 40%, rgba(0,0,0,.85) 100%)'
          : 'none',
      }}>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
          {status && status.kind !== 'unknown' && (
            <span style={{ ...badge, background: '#14B8A0', color: '#fff' }}>
              {status.kind === 'ended' ? '종료' : status.label}
            </span>
          )}
          <span style={{ ...badge, background: '#EDE6FF', color: '#5A43B5' }}>{TYPE_LABEL[form.type]}</span>
          {tagName && <span style={{ ...badge, background: '#FFE1EC', color: '#C2185B' }}>{tagName}</span>}
        </div>

        <div style={{
          fontSize: 17, fontWeight: 800, lineHeight: 1.3, marginBottom: 10, color: fg,
          textShadow: hasPhoto ? '0 1px 10px rgba(0,0,0,.5)' : 'none',
        }}>
          {form.title || '이벤트 제목이 여기에 보여요'}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 11.5, fontWeight: 700, color: fg }}>
          <EventIcon name="calendar" size={13} color={hasPhoto ? '#fff' : 'var(--accent)'} />
          {form.startDate && form.endDate ? `${fmt(form.startDate)} ~ ${fmt(form.endDate)}` : '기간 미입력'}
          {dLeft !== null && dLeft >= 0 && (
            <span style={{ ...badge, background: 'var(--accent)', color: '#fff' }}>{dLeft === 0 ? 'D-DAY' : `D-${dLeft}`}</span>
          )}
        </div>

        {form.reserveStart && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 8, fontSize: 11.5, fontWeight: 700, color: hasPhoto ? '#E4D9FF' : '#5F4B8B' }}>
            <EventIcon name="ticket" size={13} color={hasPhoto ? '#CDB8FF' : '#7C5AC7'} />
            사전예약 {fmt(form.reserveStart)} ~ {fmt(form.reserveEnd)}
            {reserveOpen && <span style={{ ...badge, background: '#7C5AC7', color: '#fff' }}>예약 중</span>}
          </div>
        )}

        {(tagName || form.placeName) && (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 12 }}>
            {tagName && <span style={tagChip(hasPhoto)}>#{tagName}</span>}
            <span style={tagChip(hasPhoto)}>#{TYPE_LABEL[form.type]}</span>
            {form.placeName && <span style={tagChip(hasPhoto)}>#{form.placeName}</span>}
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
          {(form.ticketUrls ?? []).some(u => u.trim()) && (
            <span style={{ ...previewBtn, background: 'var(--accent)', color: '#fff', border: 'none' }}>
              {reserveOpen ? '사전예약 하기' : '예매하기'}
            </span>
          )}
          <span style={previewBtn}>공유하기</span>
        </div>
      </div>
    </div>
  )
}

/* ---- 작은 컴포넌트/스타일 (ShopFormWizard 스타일) ---- */

/** 메인 이미지 업로더 — 클릭하면 파일 선택, 올리면 미리보기 */
function CoverUploader({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pick = async (file: File) => {
    setUploading(true); setError(null)
    const { url, error: e } = await uploadEventCover(file)
    setUploading(false)
    if (!url) { setError(e ?? '업로드에 실패했어요.'); return }
    onChange(url)
  }

  return (
    <div>
      <div
        onClick={() => fileRef.current?.click()}
        style={{
          width: '100%', aspectRatio: '16 / 9', maxHeight: 220,
          borderRadius: 12, border: '1.5px dashed var(--border)', background: 'var(--surface2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden', cursor: 'pointer',
        }}
      >
        {value
          ? <img src={value} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700 }}>{uploading ? '올리는 중…' : '+ 사진 올리기'}</span>}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) pick(f) }}
      />
      {error && <p style={{ fontSize: 12.5, color: '#E14B4B', marginTop: 8 }}>{error}</p>}
      {value && <button onClick={() => onChange(null)} style={{ ...linkBtn, marginTop: 8 }}>사진 지우기</button>}
    </div>
  )
}

const linkCount = (arr: string[] | undefined) => {
  const n = (arr ?? []).filter(s => s.trim()).length
  return n > 0 ? `${n}개` : '미입력'
}

/** 링크 여러 개 입력 — 공식 사이트·예매 링크가 같은 UI를 쓴다 */
function LinkList({
  label, hint, links, onChange,
}: {
  label: string
  hint: string
  links: string[]
  onChange: (v: string[]) => void
}) {
  const rows = links.length > 0 ? links : ['']
  return (
    <Field label={label} hint={hint}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map((link, i) => (
          <div key={i} style={{ display: 'flex', gap: 6 }}>
            <input
              type="url"
              value={link}
              onChange={e => { const next = [...rows]; next[i] = e.target.value; onChange(next) }}
              placeholder="https://"
              style={{ ...inp, flex: 1 }}
            />
            {rows.length > 1 && (
              <button onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label="삭제" style={delBtn}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            )}
          </div>
        ))}
        <button onClick={() => onChange([...rows, ''])} style={addLinkBtn}>+ 링크 추가</button>
      </div>
    </Field>
  )
}

function StepHead({ icon, title, sub }: { icon: EventIconName; title: string; sub: string }) {
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
      <span style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: 'var(--accent-l, #FFE6EF)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <EventIcon name={icon} size={20} color="var(--accent)" />
      </span>
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
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: ok ? 'var(--text)' : 'var(--muted)', minWidth: 0 }}>
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 260 }}>{value}</span>
      </span>
    </div>
  )
}

function CheckIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="m5 13 4 4L19 7" /></svg>
}

const inp: React.CSSProperties = {
  width: '100%', border: '1px solid var(--border)', borderRadius: 10,
  padding: '12px 13px', fontSize: 14, fontFamily: 'inherit',
  background: 'var(--surface)', color: 'var(--text)',
}
const muted: React.CSSProperties = { fontSize: 13, color: 'var(--muted)', margin: 0 }
const badge: React.CSSProperties = { fontSize: 10.5, fontWeight: 800, padding: '3px 9px', borderRadius: 9999 }
function tagChip(onPhoto: boolean): React.CSSProperties {
  return {
    fontSize: 10.5, fontWeight: 700,
    color: onPhoto ? '#fff' : 'var(--accent)',
    background: onPhoto ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.75)',
    padding: '4px 9px', borderRadius: 9999,
  }
}
const previewBtn: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: 'var(--text)',
  background: 'rgba(255,255,255,.85)', border: '1px solid rgba(0,0,0,.08)',
  padding: '7px 13px', borderRadius: 9999,
}
const picked: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
  padding: '13px 14px', borderRadius: 12, border: '1.5px solid var(--accent)', background: 'var(--accent-l)',
}
const hitRow: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2,
  width: '100%', padding: '12px 14px', border: 'none', borderBottom: '1px solid var(--border)',
  background: 'var(--surface)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
}
const delBtn: React.CSSProperties = {
  width: 42, flexShrink: 0, borderRadius: 10, border: '1px solid var(--border)',
  background: 'var(--surface)', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}
const addLinkBtn: React.CSSProperties = {
  alignSelf: 'flex-start', padding: '9px 14px', borderRadius: 10,
  border: '1.5px dashed var(--border)', background: 'transparent',
  color: 'var(--accent)', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
}
const linkBtn: React.CSSProperties = {
  border: 'none', background: 'none', padding: 0, cursor: 'pointer',
  fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, color: 'var(--accent)', flexShrink: 0,
}
const iconBtn: React.CSSProperties = {
  width: 38, height: 38, borderRadius: 9999, border: '1px solid var(--border)',
  background: 'var(--surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
}
const ghostBtn: React.CSSProperties = {
  padding: '11px 20px', borderRadius: 10, border: '1px solid var(--border)',
  background: 'var(--surface)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
}
const primaryBtn: React.CSSProperties = {
  padding: '11px 26px', borderRadius: 10, border: 'none',
  background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 800,
}
function chip(on: boolean): React.CSSProperties {
  return {
    padding: '9px 15px', borderRadius: 9999, cursor: 'pointer', fontFamily: 'inherit',
    fontSize: 13, fontWeight: 700,
    border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
    background: on ? 'var(--accent-l)' : 'var(--surface)',
    color: on ? 'var(--accent)' : 'var(--text)',
  }
}
