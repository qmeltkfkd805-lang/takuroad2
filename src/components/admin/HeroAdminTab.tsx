'use client'

import { useState, useEffect, useRef, useMemo, ReactNode } from 'react'
import { uploadBannerImage } from '@/services/featuredBannerService'
import {
  listHeroSlots, heroSummary, getHeroPreview, HeroSlotView, HeroSlotDraft,
  searchHeroEvents, searchHeroShops, searchHeroNotices, HeroCandidate,
  saveHeroSlot, endHeroSlot, deleteHeroSlot,
} from '@/services/heroAdminService'
import { HeroCategory, HeroCard } from '@/lib/home/heroTypes'
import AdminIcon from './AdminIcon'
import styles from './heroAdmin.module.css'

/* 홈 히어로 관리 (관리자 전용 UI).
   데이터 구조·서비스·권한·저장 동작은 그대로다. 표시 방법만 바꿨다.

   ⚠️ 드래그 정렬은 없다. 예전 목록의 점 6개 아이콘은 핸들러가 없는 장식이었고,
      실제 순서는 편집 폼의 '우선순위'(slot_position)로만 정해진다. 오해를 없애려고
      장식 핸들을 지우고 안내 문구로 대체했다. reorder API를 새로 만들지 않는다. */

const TYPE_LABEL: Record<HeroCategory, string> = { event: '추천 이벤트', shop: '신규 샵', notice: '중요 공지' }
const LABEL_PRESETS: Record<HeroCategory, string[]> = {
  event: ['관리자 추천 이벤트', '이번 주 오픈', '최애 작품 새 소식', '지금 뜨는 이벤트'],
  shop: ['검수 완료 신규 샵', '새로 등록된 샵', '이번 주 신규 샵'],
  notice: ['중요 공지', '서비스 안내', '긴급 공지'],
}
/* 입력 제한 — 기존 코드의 maxLength 그대로. 카운터도 이 값을 쓴다 */
const MAX = { headline: 30, desc: 60, cta: 15 } as const
/** heroSummary()가 5칸 기준으로 자동 채움을 계산한다 */
const SLOT_TOTAL = 5

type ListTab = 'draft' | 'scheduled' | 'ended'
type OriginFilter = 'all' | 'manual' | 'auto'

/* 이 화면만 폭 기준으로 레이아웃을 나눈다.
   앱 전역 useIsDesktop()은 '기기' 기준이라, PC에서 창을 좁히면 2열이 그대로 남아 넘친다. */
function useWideLayout() {
  const [wide, setWide] = useState(true)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1200px)')
    const update = () => setWide(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return wide
}

export default function HeroAdminTab() {
  const [manual, setManual] = useState<HeroSlotView[]>([])
  const [preview, setPreview] = useState<HeroCard[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [editing, setEditing] = useState<'new' | HeroSlotView>('new')
  const [panelOpen, setPanelOpen] = useState(false)   // 좁은 화면에서만 쓰는 드로어 상태
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [filter, setFilter] = useState<OriginFilter>('all')
  const [listTab, setListTab] = useState<ListTab>('draft')

  const wide = useWideLayout()
  const openerRef = useRef<HTMLButtonElement>(null)

  /* 조회는 effect 안에서만 한다. setState는 전부 then/catch 콜백 안에 둔다
     — effect 본문에서 동기로 부르면 렌더가 한 번 더 돈다(react-hooks/set-state-in-effect).
     다시 불러올 때는 reloadKey를 올려 이 effect를 재실행시킨다. */
  const [reloadKey, setReloadKey] = useState(0)
  /** 저장·삭제 뒤 새로고침 — 이벤트 핸들러에서만 부른다 */
  function reload() { setLoading(true); setReloadKey(k => k + 1) }

  useEffect(() => {
    let alive = true
    Promise.all([listHeroSlots(), getHeroPreview()])
      .then(([m, p]) => { if (!alive) return; setManual(m); setPreview(p); setLoadError(false) })
      .catch(e => { if (!alive) return; console.error('[히어로] 불러오기 실패:', e); setLoadError(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [reloadKey])

  // 메뉴는 바깥을 누르면 닫는다
  useEffect(() => {
    if (!menuFor) return
    const onDown = () => setMenuFor(null)
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [menuFor])

  const manualById = useMemo(() => new Map(manual.map(v => [v.id, v])), [manual])
  const previewManualIds = useMemo(
    () => new Set(preview.filter(c => c.origin === 'manual').map(c => c.id)), [preview])
  const offstage = useMemo(() => manual.filter(v => !previewManualIds.has(v.id)), [manual, previewManualIds])
  const sum = heroSummary(manual)

  const shown = useMemo(() => preview.filter(c =>
    filter === 'all' ? true : filter === 'manual' ? c.origin === 'manual' : c.origin !== 'manual',
  ), [preview, filter])

  const buckets = useMemo(() => {
    const b: Record<ListTab, HeroSlotView[]> = { draft: [], scheduled: [], ended: [] }
    for (const v of offstage) b[bucketOf(v)].push(v)
    return b
  }, [offstage])

  const openEditor = (target: 'new' | HeroSlotView) => {
    setEditing(target)
    setPanelOpen(true)
    setMenuFor(null)
  }
  const closeEditor = () => {
    setEditing('new')
    setPanelOpen(false)
    openerRef.current?.focus()
  }

  const panel = (
    <RegisterPanel
      key={editing === 'new' ? 'new' : editing.id || 'auto-draft'}
      initial={editing === 'new' ? null : editing}
      onSaved={() => { setEditing('new'); setPanelOpen(false); reload() }}
      onClose={closeEditor}
    />
  )

  return (
    <div className={styles.wrap}>
      <div style={{ minWidth: 0 }}>
        {/* ── 헤더 ── */}
        <header className={styles.head}>
          <div>
            <h1 className={styles.h1}>홈 히어로 관리</h1>
            <p className={styles.headSub}>홈에 노출할 콘텐츠와 순서를 관리하세요</p>
          </div>
          <button ref={openerRef} type="button" className={styles.primaryBtn}
            aria-expanded={!wide ? panelOpen : undefined}
            onClick={() => openEditor('new')}>
            <AdminIcon name="hero" size={17} />히어로 등록
          </button>
        </header>

        {loadError && (
          <div className={styles.errorBox}>목록을 불러오지 못했어요. 잠시 후 새로고침해 주세요.</div>
        )}

        {/* ── 요약 4칸 (heroSummary 그대로) ── */}
        <div className={styles.summary}>
          <Stat icon="checkin"  label="현재 노출" value={sum.shown}     tone="green" />
          <Stat icon="approve"  label="수동 고정" value={sum.pinned}    tone="pink" />
          <Stat icon="hero"     label="자동 추천" value={sum.autoFill}  tone="blue" />
          <Stat icon="season"   label="예약"      value={sum.scheduled} tone="orange" />
        </div>

        {/* ── 현재 노출 ── */}
        <section className={`${styles.card} ${styles.cardGap}`}>
          <div className={styles.listHead}>
            <div>
              <h2 className={styles.listTitle}>현재 노출<em>{sum.shown}/{SLOT_TOTAL}</em></h2>
              <p className={styles.listNote}>노출 순서는 히어로 편집에서 변경할 수 있습니다</p>
            </div>
            <div className={styles.segRow} role="group" aria-label="노출 방식 필터">
              {([['all', '전체'], ['manual', '수동'], ['auto', '자동']] as const).map(([k, t]) => (
                <button key={k} type="button" aria-pressed={filter === k}
                  className={`${styles.seg} ${filter === k ? styles.segOn : ''}`}
                  onClick={() => setFilter(k)}>{t}</button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className={styles.empty}>불러오는 중…</div>
          ) : preview.length === 0 && manual.length === 0 ? (
            <div className={styles.empty}>
              아직 노출할 콘텐츠가 없어요.<br />히어로를 등록하거나, 시작 예정 이벤트가 자동으로 채워집니다.
            </div>
          ) : shown.length === 0 ? (
            <div className={styles.empty}>이 조건에 해당하는 콘텐츠가 없어요.</div>
          ) : (
            shown.map((card, i) => {
              const view = card.origin === 'manual' ? manualById.get(card.id) : undefined
              return (
                <SlotRow
                  key={card.id}
                  rank={i + 1}
                  card={card}
                  view={view}
                  menuOpen={menuFor === card.id}
                  onToggleMenu={() => setMenuFor(m => (m === card.id ? null : card.id))}
                  onEdit={() => view && openEditor(view)}
                  onPin={() => card.origin !== 'manual' && openEditor(autoToDraft(card))}
                  onEnd={async () => { if (view && confirm('노출을 종료할까요?')) { await endHeroSlot(view.id); setMenuFor(null); reload() } }}
                  onDelete={async () => { if (view && confirm('삭제할까요?')) { await deleteHeroSlot(view.id); setMenuFor(null); reload() } }}
                />
              )
            })
          )}

          <p className={styles.info}>
            <AdminIcon name="alert" size={16} style={{ marginTop: 1 }} />
            빈 자리는 자동 추천 콘텐츠로 채워집니다.
          </p>
        </section>

        {/* ── 대기 · 예약 · 종료 ── */}
        <section className={styles.card}>
          <div className={styles.tabBar} role="tablist" aria-label="노출 대기 목록">
            {([['draft', '대기'], ['scheduled', '예약'], ['ended', '종료']] as const).map(([k, t]) => (
              <button key={k} type="button" role="tab" aria-selected={listTab === k}
                className={`${styles.tab} ${listTab === k ? styles.tabOn : ''}`}
                onClick={() => setListTab(k)}>
                {t}<span className={styles.tabCount}>{buckets[k].length}</span>
              </button>
            ))}
          </div>

          {loading ? (
            <div className={styles.empty}>불러오는 중…</div>
          ) : buckets[listTab].length === 0 ? (
            <div className={styles.empty}>
              {listTab === 'draft' ? '임시저장된 히어로가 없어요.'
                : listTab === 'scheduled' ? '예약된 히어로가 없어요.'
                  : '종료된 히어로가 없어요.'}
            </div>
          ) : (
            buckets[listTab].map((v, i) => (
              <SlotRow
                key={v.id}
                rank={i + 1}
                dim
                card={viewToCard(v)}
                view={v}
                menuOpen={menuFor === v.id}
                onToggleMenu={() => setMenuFor(m => (m === v.id ? null : v.id))}
                onEdit={() => openEditor(v)}
                onPin={() => {}}
                onEnd={async () => { if (confirm('노출을 종료할까요?')) { await endHeroSlot(v.id); setMenuFor(null); reload() } }}
                onDelete={async () => { if (confirm('삭제할까요?')) { await deleteHeroSlot(v.id); setMenuFor(null); reload() } }}
              />
            ))
          )}
        </section>
      </div>

      {/* ── 등록 패널: 넓으면 2열, 좁으면 드로어 ── */}
      {wide ? (
        <div className={styles.panelCol}>{panel}</div>
      ) : panelOpen ? (
        <DrawerShell onClose={closeEditor}>{panel}</DrawerShell>
      ) : null}
    </div>
  )
}

/* ================= 드로어 껍데기 ================= */
function DrawerShell({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return }
      // 포커스가 드로어 밖으로 나가지 않게 순환시킨다
      if (e.key !== 'Tab' || !boxRef.current) return
      const items = boxRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (items.length === 0) return
      const first = items[0], last = items[items.length - 1]
      if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    boxRef.current?.focus()
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  return (
    <div className={styles.overlay} onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={boxRef} className={styles.drawer} role="dialog" aria-modal="true" aria-label="히어로 등록" tabIndex={-1}>
        {children}
      </div>
    </div>
  )
}

/* ================= 목록 행 ================= */
function SlotRow({ rank, card, view, menuOpen, onToggleMenu, onEdit, onPin, onEnd, onDelete, dim }: {
  rank: number; card: HeroCard; view?: HeroSlotView; menuOpen: boolean
  onToggleMenu: () => void; onEdit: () => void; onPin: () => void
  onEnd: () => void; onDelete: () => void; dim?: boolean
}) {
  const isManual = card.origin === 'manual'
  const state = slotState(view)
  const sub = card.description ?? view?.sourceTitle ?? null

  return (
    <div className={`${styles.row} ${dim || view?.status === 'ended' ? styles.rowDim : ''}`}>
      <span className={styles.rank}>{rank}</span>

      <span className={`${styles.thumb} ${card.category === 'notice' && !card.imageUrl ? styles.thumbNotice : ''}`}>
        {card.imageUrl
          ? <img src={card.imageUrl} alt="" />
          : card.category === 'notice' ? <AdminIcon name="hero" size={20} color="#fff" /> : null}
      </span>

      <span className={styles.rowBody}>
        <Chip tone={card.category === 'notice' ? 'pink' : card.category === 'shop' ? 'green' : 'blue'}>
          {TYPE_LABEL[card.category]}
        </Chip>
        <span className={styles.rowTitle}>{card.headline}</span>
        {sub && <span className={styles.rowSub}>{sub}</span>}
      </span>

      <span className={styles.rowMeta}>
        <Chip tone={state.tone}>{state.label}</Chip>
        <span className={styles.period}>{periodText(view)}</span>
        {/* 읽기 전용 — 누를 수 없으므로 버튼처럼 보이지 않게 글자만 */}
        <span className={`${styles.origin} ${!isManual ? styles.originAuto : view?.is_pinned ? styles.originPinned : styles.originManual}`}>
          {!isManual ? '자동 추천' : view?.is_pinned ? '수동 고정' : '수동 등록'}
        </span>
      </span>

      <span className={styles.rowActions}>
        {isManual ? (
          <>
            <button type="button" className={styles.iconBtn} onClick={onEdit} aria-label="히어로 편집">
              <AdminIcon name="edit" size={17} />
            </button>
            <span className={styles.menuWrap} onMouseDown={e => e.stopPropagation()}>
              <button type="button" className={styles.iconBtn} onClick={onToggleMenu}
                aria-label="더보기" aria-expanded={menuOpen} aria-haspopup="menu">
                <AdminIcon name="chevron" size={17} style={{ transform: 'rotate(90deg)' }} />
              </button>
              {menuOpen && (
                <span className={styles.menu} role="menu">
                  {view?.status !== 'ended' && (
                    <button type="button" role="menuitem" className={styles.menuItem} onClick={onEnd}>노출 종료</button>
                  )}
                  <button type="button" role="menuitem" className={`${styles.menuItem} ${styles.menuDanger}`} onClick={onDelete}>삭제</button>
                </span>
              )}
            </span>
          </>
        ) : (
          <button type="button" className={styles.ghostBtn} onClick={onPin}>수동으로 고정</button>
        )}
      </span>
    </div>
  )
}

/* ================= 등록 / 수정 패널 ================= */
function RegisterPanel({ initial, onSaved, onClose }: {
  initial: HeroSlotView | null; onSaved: () => void; onClose: () => void
}) {
  const [type, setType] = useState<HeroCategory>(initial?.source_type ?? 'event')
  const [sourceId, setSourceId] = useState<string | null>(initial?.source_id ?? null)
  const [picked, setPicked] = useState<HeroCandidate | null>(
    initial ? { id: initial.source_id, title: initial.sourceTitle ?? '', thumb: initial.sourceThumb, sub: null } : null)
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
  const [previewOpen, setPreviewOpen] = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)

  const [q, setQ] = useState('')
  const [results, setResults] = useState<HeroCandidate[]>([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)

  // 이탈 확인용 — 처음 값과 달라졌는지만 본다
  const snapshot = JSON.stringify([type, sourceId, label, headline, desc, ctaText, imgMode, customImg, startDate, endDate, rank, pinned])
  // useRef를 렌더 중에 읽으면 안 되므로(react-hooks/refs) 최초 값을 state로 고정한다
  const [initialSnapshot] = useState(snapshot)
  const dirty = snapshot !== initialSnapshot

  function requestClose() {
    if (dirty && !confirm('저장하지 않은 변경 내용이 있어요. 닫을까요?')) return
    onClose()
  }

  async function runSearch() {
    setSearching(true); setOpen(true)
    const fn = type === 'event' ? searchHeroEvents : type === 'shop' ? searchHeroShops : searchHeroNotices
    setResults(await fn(q)); setSearching(false)
  }
  function changeType(t: HeroCategory) {
    setType(t); setSourceId(null); setPicked(null); setResults([]); setOpen(false)
    setLabel(LABEL_PRESETS[t][0]); if (t !== 'notice') setPinned(false)
  }

  async function handleUpload(file: File) {
    setUploading(true); setErr(null)
    const url = await uploadBannerImage(file)
    setUploading(false)
    if (!url) { setErr('이미지 업로드 실패 (URL 직접 붙여넣기 가능)'); return }
    setCustomImg(url); setImgMode('upload')
  }

  async function save(publish: boolean) {
    if (saving) return                       // 중복 제출 방지
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
  const previewTitle = headline || picked?.title || ''
  const reserve = !!startDate && startDate > new Date().toISOString().slice(0, 10)

  return (
    <div className={styles.panel}>
      <header className={styles.panelHead}>
        <div style={{ minWidth: 0 }}>
          <h2 className={styles.panelTitle}>{initial ? '히어로 수정' : '히어로 등록'}</h2>
          <p className={styles.panelSub}>홈 히어로에 노출할 콘텐츠를 설정합니다</p>
        </div>
        <button type="button" className={styles.iconBtn} onClick={requestClose} aria-label="닫기">
          <AdminIcon name="close" size={17} />
        </button>
      </header>

      <div className={styles.panelBody}>
        {/* 1. 콘텐츠 선택 */}
        <section className={styles.sec}>
          <h3 className={styles.secTitle}><span className={styles.secNum}>1</span>콘텐츠 선택</h3>
          <div className={styles.segType} role="group" aria-label="콘텐츠 유형">
            {(['event', 'shop', 'notice'] as HeroCategory[]).map(t => (
              <button key={t} type="button" aria-pressed={type === t} disabled={!!initial}
                className={`${styles.seg} ${type === t ? styles.segOn : ''}`}
                style={{ opacity: initial && type !== t ? .5 : 1, minHeight: 40 }}
                onClick={() => changeType(t)}>{TYPE_LABEL[t]}</button>
            ))}
          </div>

          <label className={styles.fieldLabel} htmlFor="hero-search">연결 콘텐츠 선택</label>
          <div className={styles.searchWrap}>
            <input id="hero-search" className={styles.input} value={q}
              onChange={e => setQ(e.target.value)}
              onFocus={() => { if (!results.length) runSearch() }}
              onKeyDown={e => e.key === 'Enter' && runSearch()}
              placeholder="연결할 콘텐츠를 검색하세요" style={{ paddingRight: 40 }} />
            <span className={styles.searchIcon}><AdminIcon name="chevron" size={16} style={{ transform: 'rotate(90deg)' }} /></span>
            {open && (
              <div className={styles.dropdown}>
                {searching ? <div className={styles.ddNote}>검색 중…</div>
                  : results.length === 0 ? <div className={styles.ddNote}>조건에 맞는 콘텐츠가 없어요</div>
                    : results.map(r => (
                      <button key={r.id} type="button" className={styles.ddItem}
                        onClick={() => { setPicked(r); setSourceId(r.id); setOpen(false) }}>
                        <Thumb src={r.thumb} w={44} h={33} />
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span className={styles.pickedTitle} style={{ marginTop: 0 }}>{r.title}</span>
                          {r.sub && <span className={styles.pickedSub}>{r.sub}</span>}
                        </span>
                      </button>
                    ))}
              </div>
            )}
          </div>

          {picked && (
            <>
              <span className={styles.fieldLabel}>선택된 콘텐츠</span>
              <div className={styles.pickedCard}>
                <Thumb src={picked.thumb} w={52} h={40} />
                <span className={styles.pickedBody}>
                  <Chip tone={type === 'notice' ? 'pink' : type === 'shop' ? 'green' : 'blue'}>{TYPE_LABEL[type]}</Chip>
                  <span className={styles.pickedTitle}>{picked.title}</span>
                  {picked.sub && <span className={styles.pickedSub}>{picked.sub}</span>}
                </span>
                <button type="button" className={styles.iconBtn}
                  onClick={() => { setPicked(null); setSourceId(null) }} aria-label="연결 해제">
                  <AdminIcon name="close" size={16} />
                </button>
              </div>
            </>
          )}
        </section>

        {/* 2. 문구 및 이미지 */}
        <section className={styles.sec}>
          <h3 className={styles.secTitle}><span className={styles.secNum}>2</span>문구 및 이미지</h3>

          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="hero-label">라벨</label>
            {/* 홈 화면과의 호환을 위해 유형별 프리셋 그대로 유지한다 */}
            <select id="hero-label" className={styles.input} value={label} onChange={e => setLabel(e.target.value)}>
              {LABEL_PRESETS[type].map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          <Field label="헤드라인" htmlFor="hero-headline" counter={`${headline.length}/${MAX.headline}`}>
            <input id="hero-headline" className={`${styles.input} ${styles.inputCounted}`} value={headline}
              maxLength={MAX.headline} onChange={e => setHeadline(e.target.value)}
              placeholder={picked?.title || '비우면 원본 제목'} />
          </Field>

          <Field label="한 줄 설명" htmlFor="hero-desc" counter={`${desc.length}/${MAX.desc}`}>
            <input id="hero-desc" className={`${styles.input} ${styles.inputCounted}`} value={desc}
              maxLength={MAX.desc} onChange={e => setDesc(e.target.value)}
              placeholder="예: 이번 주 새롭게 시작하는 전시를 만나보세요" />
          </Field>

          <Field label="CTA 텍스트" htmlFor="hero-cta" counter={`${ctaText.length}/${MAX.cta}`}>
            <input id="hero-cta" className={`${styles.input} ${styles.inputCounted}`} value={ctaText}
              maxLength={MAX.cta} onChange={e => setCtaText(e.target.value)} placeholder="자세히 보기" />
          </Field>

          <span className={styles.fieldLabel}>이미지 설정</span>
          <div className={styles.radioCards} role="radiogroup" aria-label="이미지 설정">
            <button type="button" role="radio" aria-checked={imgMode === 'source'}
              className={`${styles.radioCard} ${imgMode === 'source' ? styles.radioCardOn : ''}`}
              onClick={() => setImgMode('source')}>
              <span className={`${styles.radioDot} ${imgMode === 'source' ? styles.radioDotOn : ''}`} />
              <span style={{ minWidth: 0 }}>
                <span className={styles.radioName}>연결 콘텐츠 이미지 사용</span>
                <span className={styles.radioDesc}>연결된 콘텐츠의 대표 이미지를 사용합니다</span>
              </span>
            </button>
            <button type="button" role="radio" aria-checked={imgMode === 'upload'}
              className={`${styles.radioCard} ${imgMode === 'upload' ? styles.radioCardOn : ''}`}
              onClick={() => setImgMode('upload')}>
              <span className={`${styles.radioDot} ${imgMode === 'upload' ? styles.radioDotOn : ''}`} />
              <span style={{ minWidth: 0 }}>
                <span className={styles.radioName}>히어로 전용 이미지 업로드</span>
                <span className={styles.radioDesc}>직접 업로드한 이미지를 사용합니다</span>
              </span>
            </button>
          </div>

          {imgMode === 'upload' && (
            <div style={{ display: 'flex', gap: 8, minWidth: 0 }}>
              <input className={styles.input} value={customImg} onChange={e => setCustomImg(e.target.value)}
                placeholder="이미지 URL" aria-label="이미지 URL" style={{ flex: 1, minWidth: 0 }} />
              <button type="button" className={styles.ghostBtn} style={{ minHeight: 44, flexShrink: 0 }}
                onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? '업로드 중' : '파일'}
              </button>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = '' }} />
            </div>
          )}
        </section>

        {/* 3. 노출 설정 */}
        <section className={styles.sec}>
          <h3 className={styles.secTitle}><span className={styles.secNum}>3</span>노출 설정</h3>
          <div className={styles.grid2}>
            <Field label="노출 시작" htmlFor="hero-start">
              <input id="hero-start" type="date" className={styles.input} value={startDate} onChange={e => setStartDate(e.target.value)} />
            </Field>
            <Field label="노출 종료" htmlFor="hero-end">
              <input id="hero-end" type="date" className={styles.input} value={endDate} onChange={e => setEndDate(e.target.value)} />
            </Field>
          </div>

          <Field label="우선순위" htmlFor="hero-rank">
            <select id="hero-rank" className={styles.input} value={rank} onChange={e => setRank(e.target.value)}>
              {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}순위</option>)}
            </select>
          </Field>

          <div className={styles.field}>
            <div className={styles.toggleRow}>
              <span className={styles.fieldLabel} style={{ marginBottom: 0 }} id="hero-pin-label">첫 번째로 고정</span>
              <button type="button" role="switch" aria-checked={pinned} aria-labelledby="hero-pin-label"
                className={`${styles.toggle} ${pinned ? styles.toggleOn : ''}`}
                onClick={() => setPinned(p => !p)}>
                <span className={styles.toggleKnob} />
              </button>
            </div>
            <p className={styles.toggleHint}>목록의 첫 번째 자리에 고정됩니다</p>
          </div>
        </section>

        {/* 미리보기 */}
        <div className={styles.previewBox}>
          <button type="button" className={styles.previewHead} aria-expanded={previewOpen}
            onClick={() => setPreviewOpen(o => !o)}>
            미리보기
            <AdminIcon name="chevron" size={16} style={{ transform: previewOpen ? 'rotate(-90deg)' : 'rotate(90deg)' }} />
          </button>
          {previewOpen && (
            <>
              <div className={styles.previewTabs} role="tablist" aria-label="미리보기 기기">
                {([['pc', 'PC'], ['mobile', '모바일']] as const).map(([k, t]) => (
                  <button key={k} type="button" role="tab" aria-selected={device === k}
                    className={`${styles.previewTab} ${device === k ? styles.previewTabOn : ''}`}
                    onClick={() => setDevice(k)}>{t}</button>
                ))}
              </div>
              <div className={styles.previewPad}>
                {previewImg || previewTitle ? (
                  <HeroPreview device={device} img={previewImg ?? null} label={label}
                    title={previewTitle || '헤드라인'} desc={desc} cta={ctaText} category={type} />
                ) : (
                  <div className={styles.empty} style={{ padding: '28px 12px' }}>
                    콘텐츠를 선택하면 미리보기가 표시됩니다.
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {err && <p className={styles.errorBox} style={{ margin: '14px 0 0' }}>{err}</p>}
      </div>

      <footer className={styles.panelFoot}>
        <button type="button" className={styles.ghostBtn} style={{ minHeight: 44 }}
          onClick={() => save(false)} disabled={saving}>임시 저장</button>
        <button type="button" className={styles.primaryBtn} style={{ justifyContent: 'center' }}
          onClick={() => save(true)} disabled={saving}>
          {saving ? '저장 중…' : reserve ? '예약 게시' : '게시'}
        </button>
      </footer>
    </div>
  )
}

/* ================= 미리보기 카드 (기존 그대로) ================= */
function HeroPreview({ device, img, label, title, desc, cta, category }: {
  device: 'pc' | 'mobile'; img: string | null; label: string; title: string
  desc: string; cta: string; category: HeroCategory
}) {
  const tint = category === 'shop' ? 'linear-gradient(120deg,#E7F1FB,#F6FAFF)'
    : category === 'notice' ? 'linear-gradient(120deg,#FBEFE6,#FFF8F2)'
      : 'linear-gradient(120deg,#FBE9F1,#FFF6FA)'
  const mobile = device === 'mobile'
  return (
    <div style={{ display: 'flex', justifyContent: mobile ? 'center' : 'stretch' }}>
      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 10, border: '1px solid var(--border)', width: mobile ? 190 : '100%', minHeight: 150, display: 'flex', alignItems: 'center', background: img ? '#111' : tint, color: img ? '#fff' : '#20202D' }}>
        {img && <>
          <img src={img} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,rgba(0,0,0,.62),rgba(0,0,0,0) 82%)' }} />
        </>}
        <div style={{ position: 'relative', padding: mobile ? 14 : 20, maxWidth: mobile ? '100%' : '70%' }}>
          {label && <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 800, background: 'rgba(0,0,0,.42)', color: '#fff', padding: '3px 9px', borderRadius: 999, marginBottom: 8 }}>{label}</span>}
          <div style={{ fontSize: mobile ? 15 : 22, fontWeight: 900, lineHeight: 1.25 }}>{title}</div>
          {desc && <div style={{ fontSize: mobile ? 11.5 : 13, marginTop: 6, opacity: .9 }}>{desc}</div>}
          <div style={{ marginTop: mobile ? 10 : 14, display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fff', color: 'var(--accent)', fontWeight: 800, fontSize: mobile ? 11.5 : 13, padding: mobile ? '7px 14px' : '9px 18px', borderRadius: 9999, border: '1px solid var(--border)' }}>
            {cta || '자세히 보기'}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </div>
        </div>
        <div style={{ position: 'absolute', bottom: 10, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 5 }}>
          {[0, 1, 2, 3, 4].map(i => <span key={i} style={{ width: i === 0 ? 14 : 6, height: 6, borderRadius: 999, background: i === 0 ? '#fff' : 'rgba(255,255,255,.5)' }} />)}
        </div>
      </div>
    </div>
  )
}

/* ================= 작은 조각 ================= */
type Tone = 'green' | 'orange' | 'gray' | 'blue' | 'pink'
const TONE_CLASS: Record<Tone, string> = {
  green: styles.chipGreen, orange: styles.chipOrange, gray: styles.chipGray,
  blue: styles.chipBlue, pink: styles.chipPink,
}
function Chip({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`${styles.chip} ${TONE_CLASS[tone]}`}>{children}</span>
}

function Stat({ icon, label, value, tone }: {
  icon: 'checkin' | 'approve' | 'hero' | 'season'; label: string; value: number; tone: Tone
}) {
  const color = tone === 'green' ? '#0F6E56' : tone === 'blue' ? '#2563EB'
    : tone === 'orange' ? '#B45309' : 'var(--accent)'
  return (
    <div className={`${styles.card} ${styles.stat}`}>
      <span className={styles.statIcon} style={{ color }}><AdminIcon name={icon} size={20} /></span>
      <span className={styles.statBody}>
        <span className={styles.statLabel}>{label}</span>
        <span className={styles.statValue}>{value}</span>
      </span>
    </div>
  )
}

function Field({ label, htmlFor, counter, children }: {
  label: string; htmlFor: string; counter?: string; children: ReactNode
}) {
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel} htmlFor={htmlFor}>{label}</label>
      <div className={styles.fieldWrap}>
        {children}
        {counter && <span className={styles.counter}>{counter}</span>}
      </div>
    </div>
  )
}

function Thumb({ src, w, h }: { src: string | null; w: number; h: number }) {
  return (
    <span style={{ width: w, height: h, borderRadius: 6, overflow: 'hidden', background: 'var(--surface2)', flexShrink: 0, display: 'block' }}>
      {src && <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
    </span>
  )
}

/* ================= 유틸 (기존 로직 유지) ================= */
function toDate(iso: string | null | undefined): string { return iso ? iso.slice(0, 10) : '' }

/** 자동 추천 카드를 '수동 고정' 초안으로 — 기존 동작 그대로 */
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

/** 목록 행에 쓸 카드 모양으로 (노출 대기 목록용) */
function viewToCard(v: HeroSlotView): HeroCard {
  return {
    id: v.id, category: v.source_type, origin: 'manual', label: v.label,
    headline: v.custom_headline ?? v.sourceTitle ?? '(제목 없음)',
    description: v.custom_description, imageUrl: v.sourceThumb,
    ctaText: v.cta_text, ctaHref: '#', badge: null, meta: null,
  } as HeroCard
}

/** 노출 대기 항목을 대기/예약/종료 중 하나로 (겹치지 않게) */
function bucketOf(v: HeroSlotView): ListTab {
  const now = Date.now()
  if (v.status === 'ended') return 'ended'
  if (v.ends_at && Date.parse(v.ends_at) < now) return 'ended'
  if (v.status === 'scheduled') return 'scheduled'
  if (v.starts_at && Date.parse(v.starts_at) > now) return 'scheduled'
  return 'draft'
}

/** 상태 배지 — 노출 중 초록 / 예약 주황 / 종료·임시저장 회색 */
function slotState(v?: HeroSlotView): { label: string; tone: Tone } {
  if (!v) return { label: '노출 중', tone: 'green' }          // 자동 추천 카드는 지금 나가는 중
  if (v.status === 'ended') return { label: '종료', tone: 'gray' }
  if (v.status === 'draft') return { label: '임시저장', tone: 'gray' }
  const now = Date.now()
  if (v.ends_at && Date.parse(v.ends_at) < now) return { label: '종료', tone: 'gray' }
  if (v.starts_at && Date.parse(v.starts_at) > now) return { label: '예약', tone: 'orange' }
  return { label: '노출 중', tone: 'green' }
}

/** 노출 기간 — 데이터가 없으면 '상시' */
function periodText(v?: HeroSlotView): string {
  if (!v) return '상시'
  const fmt = (iso: string) => iso.slice(0, 10).replace(/-/g, '.')
  const s = v.starts_at ? fmt(v.starts_at) : null
  const e = v.ends_at ? fmt(v.ends_at) : null
  if (s && e) return `${s} ~ ${e}`
  if (e) return `~ ${e}`
  if (s) return `${s} ~`
  return '상시'
}
