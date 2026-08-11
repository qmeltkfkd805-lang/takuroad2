'use client'

import { useState, useEffect, useRef, CSSProperties, ReactNode } from 'react'
import { uploadBannerImage } from '@/services/featuredBannerService'
import {
  listHeroSlots, heroSummary, getHeroPreview, HeroSlotView, HeroSlotDraft,
  searchHeroEvents, searchHeroShops, searchHeroNotices, HeroCandidate,
  saveHeroSlot, endHeroSlot, deleteHeroSlot,
} from '@/services/heroAdminService'
import { HeroCategory, HeroCard, heroOriginBadge } from '@/lib/home/heroTypes'

const inputStyle: CSSProperties = { width: '100%', padding: '9px 11px', borderRadius: 9, border: '1px solid var(--border)', fontFamily: 'inherit', fontSize: 13.5, background: 'var(--surface)', color: 'var(--text)' }
const TYPE_LABEL: Record<HeroCategory, string> = { event: '추천 이벤트', shop: '신규 샵', notice: '중요 공지' }
const LABEL_PRESETS: Record<HeroCategory, string[]> = {
  event: ['관리자 추천 이벤트', '이번 주 오픈', '최애 작품 새 소식', '지금 뜨는 이벤트'],
  shop: ['검수 완료 신규 샵', '새로 등록된 샵', '이번 주 신규 샵'],
  notice: ['중요 공지', '서비스 안내', '긴급 공지'],
}

export default function HeroAdminTab() {
  const [manual, setManual] = useState<HeroSlotView[]>([])
  const [preview, setPreview] = useState<HeroCard[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<'new' | HeroSlotView>('new')
  const [menuFor, setMenuFor] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const [m, p] = await Promise.all([listHeroSlots(), getHeroPreview()])
    setManual(m); setPreview(p); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const manualById = new Map(manual.map(v => [v.id, v]))
  const previewManualIds = new Set(preview.filter(c => c.origin === 'manual').map(c => c.id))
  // 현재 노출되지 않는 수동 슬롯(임시저장·예약·종료)
  const offstage = manual.filter(v => !previewManualIds.has(v.id))
  const sum = heroSummary(manual)

  return (
    <div style={{ padding: 16, display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      {/* ===== 좌: 요약 + 노출 순서 ===== */}
      <div style={{ flex: '1 1 460px', minWidth: 380 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>홈 히어로 관리</h2>
            <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '4px 0 0' }}>홈에 노출할 최대 5개의 콘텐츠를 관리해요</p>
          </div>
          <button onClick={() => setEditing('new')} style={{ flexShrink: 0, padding: '10px 16px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}>+ 히어로 등록</button>
        </div>

        {/* 요약 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, padding: 16, border: '1px solid var(--border)', borderRadius: 16, marginBottom: 16 }}>
          <Stat label="현재 노출" value={sum.shown} color="var(--accent)" />
          <Stat label="수동 고정" value={sum.pinned} color="var(--text)" />
          <Stat label="자동 추천" value={sum.autoFill} color="#2f80ed" />
          <Stat label="예약" value={sum.scheduled} color="#f2a005" />
        </div>

        {/* 노출 순서 */}
        <div style={{ border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '16px 18px 10px', fontSize: 15, fontWeight: 900 }}>노출 순서</div>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>불러오는 중...</div>
          ) : preview.length === 0 && manual.length === 0 ? (
            <div style={{ padding: '44px 20px', textAlign: 'center', color: 'var(--muted)' }}>아직 노출할 콘텐츠가 없어요. 오른쪽에서 히어로를 등록하거나, 시작 예정 이벤트가 자동으로 채워집니다.</div>
          ) : (
            <div>
              {preview.map((card, i) => {
                const view = card.origin === 'manual' ? manualById.get(card.id) : undefined
                return (
                  <Row
                    key={card.id}
                    index={i + 1}
                    card={card}
                    view={view}
                    menuOpen={menuFor === card.id}
                    onToggleMenu={() => setMenuFor(m => m === card.id ? null : card.id)}
                    onEdit={() => view && setEditing(view)}
                    onPin={() => card.origin !== 'manual' && setEditing(autoToDraft(card))}
                    onEnd={async () => { if (view && confirm('노출을 종료할까요?')) { await endHeroSlot(view.id); setMenuFor(null); load() } }}
                    onDelete={async () => { if (view && confirm('삭제할까요?')) { await deleteHeroSlot(view.id); setMenuFor(null); load() } }}
                  />
                )
              })}
            </div>
          )}
          <div style={{ padding: '12px 16px', background: 'var(--surface2)', fontSize: 12.5, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <InfoDot /> 수동 콘텐츠를 우선 배치하고 빈 자리는 자동 추천으로 채워요.
          </div>
        </div>

        {/* 노출 대기 (임시저장·예약·종료) */}
        {offstage.length > 0 && (
          <div style={{ marginTop: 16, border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px 8px', fontSize: 13.5, fontWeight: 900, color: 'var(--muted)' }}>대기 중 (임시저장 · 예약 · 종료)</div>
            {offstage.map((v, i) => (
              <Row key={v.id} index={i + 1} muted
                card={{ id: v.id, category: v.source_type, origin: 'manual', label: v.label, headline: v.custom_headline ?? v.sourceTitle ?? '(제목 없음)', description: null, imageUrl: v.sourceThumb, ctaText: null, ctaHref: '#', badge: null, meta: null }}
                view={v}
                menuOpen={menuFor === v.id}
                onToggleMenu={() => setMenuFor(m => m === v.id ? null : v.id)}
                onEdit={() => setEditing(v)}
                onPin={() => {}}
                onEnd={async () => { if (confirm('노출을 종료할까요?')) { await endHeroSlot(v.id); setMenuFor(null); load() } }}
                onDelete={async () => { if (confirm('삭제할까요?')) { await deleteHeroSlot(v.id); setMenuFor(null); load() } }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ===== 우: 등록/수정 패널 ===== */}
      <div style={{ flex: '0 0 440px', minWidth: 360, maxWidth: 460, position: 'sticky', top: 16 }}>
        <RegisterPanel
          key={editing === 'new' ? 'new' : editing.id}
          initial={editing === 'new' ? null : editing}
          onSaved={() => { setEditing('new'); load() }}
          onClose={() => setEditing('new')}
        />
      </div>
    </div>
  )
}

/* ================= 리스트 행 ================= */
function Row({ index, card, view, menuOpen, onToggleMenu, onEdit, onPin, onEnd, onDelete, muted }: {
  index: number; card: HeroCard; view?: HeroSlotView; menuOpen: boolean
  onToggleMenu: () => void; onEdit: () => void; onPin: () => void; onEnd: () => void; onDelete: () => void; muted?: boolean
}) {
  const isManual = card.origin === 'manual'
  const badge = heroOriginBadge({ origin: card.origin, category: card.category, isPinned: view?.is_pinned })
  const tone = card.origin !== 'manual' ? 'gray' : card.category === 'notice' ? 'pink' : card.category === 'shop' ? 'green' : 'accent'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderTop: '1px solid var(--border)', opacity: muted || view?.status === 'ended' ? 0.6 : 1, position: 'relative' }}>
      <span style={{ color: 'var(--border)', cursor: 'grab', flexShrink: 0 }}><DragDots /></span>
      <span style={{ width: 18, textAlign: 'center', fontWeight: 900, fontSize: 16, flexShrink: 0 }}>{index}</span>
      <div style={{ width: 58, height: 44, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: card.category === 'notice' && !card.imageUrl ? 'var(--accent)' : 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {card.imageUrl ? <img src={card.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : card.category === 'notice' ? <Megaphone /> : null}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Badge tone={tone}>{badge}</Badge>
        <div style={{ fontSize: 15, fontWeight: 800, marginTop: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.headline}</div>
      </div>
      <span style={{ fontSize: 12.5, color: exposureColor(view), fontWeight: 600, flexShrink: 0, marginRight: 4, whiteSpace: 'nowrap' }}>{exposureText(view)}</span>
      {isManual ? (
        <>
          <IconBtn onClick={onEdit} title="수정"><Pencil /></IconBtn>
          <div style={{ position: 'relative' }}>
            <IconBtn onClick={onToggleMenu} title="더보기"><Kebab /></IconBtn>
            {menuOpen && (
              <div style={{ position: 'absolute', right: 0, top: '100%', zIndex: 10, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.14)', overflow: 'hidden', minWidth: 120 }}>
                {view?.status !== 'ended' && <MenuItem onClick={onEnd}>노출 종료</MenuItem>}
                <MenuItem danger onClick={onDelete}>삭제</MenuItem>
              </div>
            )}
          </div>
        </>
      ) : (
        <button onClick={onPin} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>수동 고정</button>
      )}
    </div>
  )
}

/* ================= 등록/수정 패널 ================= */
function RegisterPanel({ initial, onSaved, onClose }: { initial: HeroSlotView | null; onSaved: () => void; onClose: () => void }) {
  const [type, setType] = useState<HeroCategory>(initial?.source_type ?? 'event')
  const [sourceId, setSourceId] = useState<string | null>(initial?.source_id ?? null)
  const [picked, setPicked] = useState<HeroCandidate | null>(
    initial ? { id: initial.source_id, title: initial.sourceTitle ?? '', thumb: initial.sourceThumb ?? null, sub: initial.startDate ? `검수 완료 · ${initial.startDate}` : null } : null,
  )
  const [label, setLabel] = useState(initial?.label ?? LABEL_PRESETS[initial?.source_type ?? 'event'][0])
  const [headline, setHeadline] = useState(initial?.custom_headline ?? '')
  const [desc, setDesc] = useState(initial?.custom_description ?? '')
  const [ctaText, setCtaText] = useState(initial?.cta_text ?? '자세히 보기')
  const [imgMode, setImgMode] = useState<'source' | 'upload'>(initial?.custom_image_url ? 'upload' : 'source')
  const [customImg, setCustomImg] = useState(initial?.custom_image_url ?? '')
  const [startDate, setStartDate] = useState(toDate(initial?.starts_at))
  const [endDate, setEndDate] = useState(toDate(initial?.ends_at))
  const [rank, setRank] = useState(String(initial?.slot_position || 1))
  const [pinned, setPinned] = useState(initial?.is_pinned ?? false)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [device, setDevice] = useState<'pc' | 'mobile'>('pc')
  const fileRef = useRef<HTMLInputElement>(null)

  const [q, setQ] = useState('')
  const [results, setResults] = useState<HeroCandidate[]>([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)

  async function runSearch() {
    setSearching(true); setOpen(true)
    const fn = type === 'event' ? searchHeroEvents : type === 'shop' ? searchHeroShops : searchHeroNotices
    setResults(await fn(q)); setSearching(false)
  }
  function changeType(t: HeroCategory) { setType(t); setSourceId(null); setPicked(null); setResults([]); setOpen(false); setLabel(LABEL_PRESETS[t][0]); if (t !== 'notice') setPinned(false) }

  async function handleUpload(file: File) {
    setUploading(true); setErr(null)
    const url = await uploadBannerImage(file)
    setUploading(false)
    if (!url) { setErr('이미지 업로드 실패 (URL 직접 붙여넣기 가능)'); return }
    setCustomImg(url); setImgMode('upload')
  }

  async function save(publish: boolean) {
    if (!sourceId) { setErr('연결할 콘텐츠를 선택해주세요'); return }
    setSaving(true); setErr(null)
    const n = Number.isNaN(parseInt(rank, 10)) ? 1 : parseInt(rank, 10)
    const draft: HeroSlotDraft = {
      source_type: type, source_id: sourceId,
      label: label.trim() || null,
      custom_headline: headline.trim() || null,
      custom_description: desc.trim() || null,
      custom_image_url: imgMode === 'upload' ? (customImg.trim() || null) : null,
      cta_text: ctaText.trim() || null,
      cta_href: null,
      starts_at: startDate ? `${startDate}T00:00:00.000Z` : null,
      ends_at: endDate ? `${endDate}T23:59:59.999Z` : null,
      slot_position: n, priority: n,
      is_pinned: pinned,
      status: publish ? 'published' : 'draft',
    }
    const res = await saveHeroSlot(draft, initial?.id)
    setSaving(false)
    if (!res.ok) { setErr(res.error ?? '저장 실패 (같은 콘텐츠가 이미 등록됐을 수 있어요)'); return }
    onSaved()
  }

  const previewImg = imgMode === 'upload' ? (customImg || picked?.thumb) : picked?.thumb
  const previewTitle = headline || picked?.title || '헤드라인'
  const reserve = !!startDate && startDate > new Date().toISOString().slice(0, 10)

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', background: 'var(--surface)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 18px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 16, fontWeight: 900 }}>{initial ? '히어로 수정' : '히어로 등록'}</span>
        <IconBtn onClick={onClose} title="닫기"><Close /></IconBtn>
      </div>

      <div style={{ padding: 18, maxHeight: 'calc(100vh - 160px)', overflowY: 'auto' }}>
        {/* 1. 콘텐츠 유형 */}
        <SecTitle n="1" title="콘텐츠 유형" />
        <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
          {(['event', 'shop', 'notice'] as HeroCategory[]).map(t => (
            <button key={t} onClick={() => changeType(t)} disabled={!!initial} style={seg(type === t, !!initial && type !== t)}>{TYPE_LABEL[t]}</button>
          ))}
        </div>

        {/* 2. 연결 콘텐츠 */}
        <SecTitle n="2" title="연결 콘텐츠" />
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }}><Search /></span>
          <input value={q} onChange={e => setQ(e.target.value)} onFocus={() => { if (!results.length) runSearch() }} onKeyDown={e => e.key === 'Enter' && runSearch()} placeholder="등록된 이벤트·샵·공지를 검색" style={{ ...inputStyle, paddingRight: 36 }} />
          {open && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, marginTop: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.12)', maxHeight: 240, overflowY: 'auto' }}>
              {searching ? <div style={{ padding: 14, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>검색 중...</div>
                : results.length === 0 ? <div style={{ padding: 14, textAlign: 'center', color: 'var(--muted)', fontSize: 12.5 }}>조건에 맞는 콘텐츠가 없어요</div>
                  : results.map(r => (
                    <button key={r.id} onClick={() => { setPicked(r); setSourceId(r.id); setOpen(false); if (!headline) setHeadline('') }} style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 10, padding: '8px 10px', border: 'none', borderBottom: '1px solid var(--border)', background: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                      <Thumb src={r.thumb} w={40} h={30} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</div>
                        {r.sub && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{r.sub}</div>}
                      </div>
                    </button>
                  ))}
            </div>
          )}
        </div>
        {picked && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, border: '1px solid var(--border)', borderRadius: 12, marginBottom: 18 }}>
            <Thumb src={picked.thumb} w={48} h={38} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <Badge tone={type === 'notice' ? 'pink' : type === 'shop' ? 'green' : 'accent'}>{TYPE_LABEL[type].replace(' ', '')}</Badge>
                <span style={{ fontSize: 13.5, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{picked.title}</span>
              </div>
              <div style={{ fontSize: 11.5, color: '#0F6E56', fontWeight: 700 }}>✓ 연결됨{picked.sub ? ` · ${picked.sub}` : ''}</div>
            </div>
            <IconBtn onClick={() => { setPicked(null); setSourceId(null) }} title="해제"><Close /></IconBtn>
          </div>
        )}

        {/* 3. 노출 설정 */}
        <SecTitle n="3" title="노출 설정" />
        <FormRow label="라벨">
          <select value={label} onChange={e => setLabel(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
            {LABEL_PRESETS[type].map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </FormRow>
        <FormRow label="헤드라인" counter={`${headline.length}/30`}>
          <input value={headline} maxLength={30} onChange={e => setHeadline(e.target.value)} placeholder={picked?.title || '비우면 원본 제목'} style={inputStyle} />
        </FormRow>
        <FormRow label="한 줄 설명" counter={`${desc.length}/60`}>
          <input value={desc} maxLength={60} onChange={e => setDesc(e.target.value)} placeholder="예: 이번 주 새롭게 시작하는 전시를 만나보세요" style={inputStyle} />
        </FormRow>
        <FormRow label="CTA 텍스트" counter={`${ctaText.length}/15`}>
          <input value={ctaText} maxLength={15} onChange={e => setCtaText(e.target.value)} placeholder="자세히 보기" style={inputStyle} />
        </FormRow>
        <div style={{ display: 'flex', gap: 10 }}>
          <FormRow label="노출 시작"><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} /></FormRow>
          <FormRow label="노출 종료"><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={inputStyle} /></FormRow>
        </div>
        <FormRow label="우선순위">
          <select value={rank} onChange={e => setRank(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
            {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}순위</option>)}
          </select>
        </FormRow>
        <FormRow label="첫 번째로 고정">
          <Toggle on={pinned} onClick={() => setPinned(p => !p)} />
        </FormRow>

        {/* 이미지 라디오 */}
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', margin: '4px 0 18px' }}>
          <Radio checked={imgMode === 'source'} onClick={() => setImgMode('source')}>연결 콘텐츠 이미지 사용</Radio>
          <Radio checked={imgMode === 'upload'} onClick={() => setImgMode('upload')}>히어로 전용 이미지 업로드</Radio>
        </div>
        {imgMode === 'upload' && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input value={customImg} onChange={e => setCustomImg(e.target.value)} placeholder="이미지 URL" style={{ ...inputStyle, flex: 1 }} />
            <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ padding: '0 14px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface2)', fontWeight: 700, fontSize: 13, cursor: uploading ? 'wait' : 'pointer', fontFamily: 'inherit' }}>{uploading ? '업로드 중' : '파일'}</button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = '' }} />
          </div>
        )}

        {err && <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--red)', margin: '0 0 12px' }}>{err}</p>}

        {/* 버튼 */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginBottom: 8 }}>
          <button onClick={() => save(false)} disabled={saving} style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 800, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}>임시 저장</button>
          <button onClick={() => save(true)} disabled={saving} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}>{saving ? '저장 중…' : reserve ? '예약 게시' : '게시'}</button>
        </div>
      </div>

      {/* 미리보기 */}
      <div style={{ borderTop: '1px solid var(--border)', padding: 16 }}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
          <PreviewTab active={device === 'pc'} onClick={() => setDevice('pc')}>PC 미리보기</PreviewTab>
          <PreviewTab active={device === 'mobile'} onClick={() => setDevice('mobile')}>모바일 미리보기</PreviewTab>
        </div>
        <HeroPreview device={device} img={previewImg ?? null} label={label} title={previewTitle} desc={desc} cta={ctaText} category={type} />
      </div>
    </div>
  )
}

/* ================= 미리보기 카드 ================= */
function HeroPreview({ device, img, label, title, desc, cta, category }: { device: 'pc' | 'mobile'; img: string | null; label: string; title: string; desc: string; cta: string; category: HeroCategory }) {
  const tint = category === 'shop' ? 'linear-gradient(120deg,#E7F1FB,#F6FAFF)' : category === 'notice' ? 'linear-gradient(120deg,#FBEFE6,#FFF8F2)' : 'linear-gradient(120deg,#FBE9F1,#FFF6FA)'
  const mobile = device === 'mobile'
  return (
    <div style={{ display: 'flex', justifyContent: mobile ? 'center' : 'stretch' }}>
      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 14, border: '1px solid var(--border)', width: mobile ? 190 : '100%', minHeight: mobile ? 150 : 150, display: 'flex', alignItems: 'center', background: img ? '#111' : tint, color: img ? '#fff' : '#20202D' }}>
        {img && <><img src={img} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} /><div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,rgba(0,0,0,.62),rgba(0,0,0,0) 82%)' }} /></>}
        <div style={{ position: 'relative', padding: mobile ? 14 : 20, maxWidth: mobile ? '100%' : '70%' }}>
          {label && <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 800, background: 'rgba(0,0,0,.42)', color: '#fff', padding: '3px 9px', borderRadius: 999, marginBottom: 8 }}>{label}</span>}
          <div style={{ fontSize: mobile ? 15 : 22, fontWeight: 900, lineHeight: 1.25 }}>{title}</div>
          {desc && <div style={{ fontSize: mobile ? 11.5 : 13, marginTop: 6, opacity: .9 }}>{desc}</div>}
          <div style={{ marginTop: mobile ? 10 : 14, display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fff', color: 'var(--accent)', fontWeight: 800, fontSize: mobile ? 11.5 : 13, padding: mobile ? '7px 14px' : '9px 18px', borderRadius: 9999, border: '1px solid var(--border)', boxShadow: '0 3px 10px rgba(0,0,0,.08)' }}>{cta || '자세히 보기'}<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg></div>
        </div>
        <div style={{ position: 'absolute', bottom: 10, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 5 }}>
          {[0, 1, 2, 3, 4].map(i => <span key={i} style={{ width: i === 0 ? 14 : 6, height: 6, borderRadius: 999, background: i === 0 ? '#fff' : 'rgba(255,255,255,.5)' }} />)}
        </div>
      </div>
    </div>
  )
}

/* ================= 작은 조각 ================= */
function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 700, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color }}>{value}</div>
    </div>
  )
}
function SecTitle({ n, title }: { n: string; title: string }) {
  return <div style={{ fontSize: 14, fontWeight: 900, margin: '0 0 10px' }}>{n}. {title}</div>
}
function FormRow({ label, counter, children }: { label: string; counter?: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flex: 1 }}>
      <label style={{ width: 72, flexShrink: 0, fontSize: 12.5, fontWeight: 700, color: 'var(--muted)' }}>{label}</label>
      <div style={{ flex: 1, position: 'relative' }}>
        {children}
        {counter && <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--muted)', pointerEvents: 'none' }}>{counter}</span>}
      </div>
    </div>
  )
}
function Badge({ children, tone }: { children: ReactNode; tone: 'accent' | 'green' | 'pink' | 'gray' }) {
  const map = { accent: ['#FFE6EF', 'var(--accent)'], green: ['#E1F5EE', '#0F6E56'], pink: ['#FBEAF0', '#993556'], gray: ['#EEF0F3', '#5b6472'] } as const
  const [bg, fg] = map[tone]
  return <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 999, background: bg, color: fg }}>{children}</span>
}
function IconBtn({ children, onClick, title }: { children: ReactNode; onClick: () => void; title?: string }) {
  return <button onClick={onClick} title={title} style={{ width: 34, height: 34, borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--muted)', flexShrink: 0 }}>{children}</button>
}
function MenuItem({ children, onClick, danger }: { children: ReactNode; onClick: () => void; danger?: boolean }) {
  return <button onClick={onClick} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: danger ? 'var(--red)' : 'var(--text)' }}>{children}</button>
}
function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return <button onClick={onClick} style={{ width: 40, height: 23, borderRadius: 999, border: 'none', background: on ? 'var(--accent)' : 'var(--border)', position: 'relative', cursor: 'pointer', padding: 0 }}>
    <span style={{ position: 'absolute', top: 2, left: on ? 19 : 2, width: 19, height: 19, borderRadius: 999, background: '#fff', transition: 'left .15s' }} />
  </button>
}
function Radio({ checked, onClick, children }: { checked: boolean; onClick: () => void; children: ReactNode }) {
  return <button onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, color: 'var(--text)', padding: 0 }}>
    <span style={{ width: 16, height: 16, borderRadius: 999, border: `2px solid ${checked ? 'var(--accent)' : 'var(--border)'}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{checked && <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--accent)' }} />}</span>
    {children}
  </button>
}
function PreviewTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return <button onClick={onClick} style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 800, color: active ? 'var(--text)' : 'var(--muted)', padding: '0 0 6px', borderBottom: `2px solid ${active ? 'var(--accent)' : 'transparent'}` }}>{children}</button>
}
function Thumb({ src, w, h }: { src: string | null; w: number; h: number }) {
  return <div style={{ width: w, height: h, borderRadius: 7, overflow: 'hidden', background: 'var(--surface2)', flexShrink: 0 }}>{src && <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}</div>
}
function seg(active: boolean, dim: boolean): CSSProperties {
  return { flex: 1, padding: '9px 6px', borderRadius: 9, border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`, background: active ? 'var(--accent-l, #FFE6EF)' : 'var(--surface)', color: active ? 'var(--accent)' : 'var(--text)', fontWeight: 800, fontSize: 13, cursor: dim ? 'default' : 'pointer', fontFamily: 'inherit', opacity: dim ? 0.5 : 1 }
}

/* 아이콘 */
function DragDots() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" /><circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" /></svg> }
function Pencil() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg> }
function Kebab() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg> }
function Close() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg> }
function Search() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg> }
function Megaphone() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11v2a1 1 0 0 0 1 1h2l4 4V7L6 11H4a1 1 0 0 0-1 0z" /><path d="M15 8a4 4 0 0 1 0 8" /></svg> }
function InfoDot() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" strokeLinecap="round" /></svg> }

/* 유틸 */
function toDate(iso: string | null | undefined): string { return iso ? iso.slice(0, 10) : '' }
function autoToDraft(card: HeroCard): HeroSlotView {
  const eventId = card.id.replace(/^auto:event:/, '')
  return {
    id: '', source_type: 'event', source_id: eventId, label: '관리자 추천 이벤트',
    custom_headline: null, custom_description: card.description, custom_image_url: null,
    cta_text: card.ctaText, cta_href: null, starts_at: null, ends_at: null,
    slot_position: 1, priority: 1, is_pinned: false, status: 'draft',
    created_at: '', updated_at: '',
    sourceTitle: card.headline, sourceThumb: card.imageUrl, sourceOk: true, startDate: null,
  } as HeroSlotView
}
function exposureText(v?: HeroSlotView): string {
  if (!v) return '상시 노출'
  if (v.status === 'draft') return '임시저장'
  if (v.status === 'ended') return '종료됨'
  const today = new Date().toISOString().slice(0, 10)
  const s = v.starts_at?.slice(0, 10)
  const e = v.ends_at?.slice(0, 10)
  const md = (x: string) => `${parseInt(x.slice(5, 7), 10)}.${parseInt(x.slice(8, 10), 10)}`
  if (s && s > today) return `${md(s)}부터 노출`
  if (e && e === today) return '오늘 종료'
  if (e) return `${md(e)}까지`
  return '상시 노출'
}
function exposureColor(v?: HeroSlotView): string {
  if (!v) return 'var(--muted)'
  const today = new Date().toISOString().slice(0, 10)
  if (v.ends_at?.slice(0, 10) === today) return 'var(--accent)'
  if (v.status === 'draft' || v.status === 'ended') return 'var(--muted)'
  return 'var(--muted)'
}
