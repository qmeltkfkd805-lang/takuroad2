'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdminIcon, { AdminIconName } from './AdminIcon'
import styles from './placeAdmin.module.css'

/* 장소(Place) 관리 — 대표 이미지가 컬렉션 카드의 얼굴이 된다.
   Place는 수가 적어서(스타필드·코엑스·DDP…) 운영자가 직접 관리해도 부담이 없다.

   조회·저장 구조는 그대로다: 이 컴포넌트가 places를 직접 읽고,
   업로드는 storage('places')에, URL 저장은 /api/admin/upsert에 맡긴다.
   ⚠️ 이미지를 지우거나 교체해도 스토리지의 이전 파일은 남는다(기존 동작 유지).
      고아 파일 정리는 별도 작업으로 뺐다. */

interface Place {
  id: string
  name: string
  slug: string
  place_type: string | null
  addr: string | null
  cover_image: string | null
}

const MAX_MB = 5
const PAGE_SIZE = 12

type CoverFilter = 'all' | 'has' | 'need'
type SortKey = 'name' | 'need'

const SORTS: { value: SortKey; label: string }[] = [
  { value: 'name', label: '장소명 가나다순' },
  { value: 'need', label: '이미지 필요 먼저' },
]

/* cover_image는 null·빈 문자열·공백만 있는 문자열이 모두 "없음"이다.
   화면 전체가 이 한 함수만 보고 판단하도록 모아둔다. */
function coverUrl(p: Place): string | null {
  const v = p.cover_image?.trim()
  return v ? v : null
}

async function uploadPlaceCover(file: File): Promise<{ url: string | null; error: string | null }> {
  if (file.size > MAX_MB * 1024 * 1024) return { url: null, error: `사진은 ${MAX_MB}MB 이하만 올릴 수 있어요.` }

  const supabase = createClient()
  const mime = file.type.split('/')[1]
  const ext = mime && /^[a-z0-9]+$/i.test(mime) ? (mime === 'jpeg' ? 'jpg' : mime) : 'jpg'
  const rand = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const path = `covers/${rand}.${ext}`

  const { error } = await supabase.storage.from('places').upload(path, file)
  if (error) {
    console.error('[Place 커버 업로드 실패]', error.message)
    return { url: null, error: error.message }
  }
  const { data } = supabase.storage.from('places').getPublicUrl(path)
  return { url: data.publicUrl, error: null }
}

async function saveCover(id: string, coverImage: string | null): Promise<string | null> {
  const res = await fetch('/api/admin/upsert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ table: 'places', id, fields: { cover_image: coverImage } }),
  })
  if (!res.ok) {
    const j = await res.json().catch(() => ({}))
    return j.error ?? '저장에 실패했어요'
  }
  return null
}

export default function PlaceAdminTab() {
  const [places, setPlaces] = useState<Place[]>([])
  const [failed, setFailed] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 다시 불러오기는 키를 올려서 요청한다 (effect 안에서 곧바로 setState 하지 않기 위해)
  const [reloadKey, setReloadKey] = useState(0)
  const [loadedKey, setLoadedKey] = useState(-1)
  const loading = loadedKey !== reloadKey

  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<CoverFilter>('all')
  const [sort, setSort] = useState<SortKey>('name')
  const [page, setPage] = useState(0)

  /* 이미지 URL은 있는데 실제로 안 뜨는 경우. 카드가 페이지를 넘나들어도 유지되도록
     부모가 id 집합으로 들고 있는다. 새 이미지를 올리면 그 id는 지운다. */
  const [brokenIds, setBrokenIds] = useState<Record<string, true>>({})

  useEffect(() => {
    let alive = true
    const key = reloadKey
    const supabase = createClient()
    supabase
      .from('places')
      .select('id, name, slug, place_type, addr, cover_image')
      .order('name')
      .then(({ data, error }) => {
        if (!alive) return
        if (error) {
          console.error('[Place 목록]', error.message)
          setFailed(true)
          setPlaces([])
        } else {
          setFailed(false)
          setPlaces((data ?? []) as Place[])
        }
        setLoadedKey(key)
      })
    return () => { alive = false }
  }, [reloadKey])

  useEffect(() => () => { if (msgTimer.current) clearTimeout(msgTimer.current) }, [])

  function toast(m: string) {
    setMsg(m)
    if (msgTimer.current) clearTimeout(msgTimer.current)
    msgTimer.current = setTimeout(() => setMsg(null), 2800)
  }

  const counts = useMemo(() => {
    const has = places.filter((p) => coverUrl(p) !== null).length
    return { all: places.length, has, need: places.length - has }
  }, [places])

  /* 전체 → 검색 → 이미지 상태 필터 → 정렬 (페이지네이션은 아래에서) */
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    let out = places
    if (needle) {
      // 이름과 주소를 각각 검사한다. 이어 붙이면 경계를 걸친 오탐이 생긴다
      out = out.filter((p) =>
        p.name.trim().toLowerCase().includes(needle) ||
        (p.addr ?? '').trim().toLowerCase().includes(needle))
    }
    if (filter === 'has') out = out.filter((p) => coverUrl(p) !== null)
    else if (filter === 'need') out = out.filter((p) => coverUrl(p) === null)

    const sorted = [...out]
    if (sort === 'need') {
      // 이미지 없는 것 먼저, 그 안에서는 이름순
      sorted.sort((a, b) => {
        const av = coverUrl(a) === null ? 0 : 1
        const bv = coverUrl(b) === null ? 0 : 1
        return av !== bv ? av - bv : a.name.localeCompare(b.name, 'ko')
      })
    } else {
      sorted.sort((a, b) => a.name.localeCompare(b.name, 'ko'))
    }
    return sorted
  }, [places, q, filter, sort])

  // 조건이 바뀌면 1페이지로 (effect 대신 렌더 중 파생 상태 조정)
  const listKey = `${q}|${filter}|${sort}`
  const [prevListKey, setPrevListKey] = useState(listKey)
  if (listKey !== prevListKey) { setPrevListKey(listKey); setPage(0) }

  // 이미지 추가·삭제로 목록이 줄어 현재 페이지가 비면 마지막 페이지로 당긴다
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const from = safePage * PAGE_SIZE
  const pageItems = filtered.slice(from, from + PAGE_SIZE)

  async function onPick(place: Place, file: File) {
    setBusyId(place.id)
    const { url, error } = await uploadPlaceCover(file)
    if (!url) { toast(error ?? '업로드에 실패했어요'); setBusyId(null); return }
    const saveErr = await saveCover(place.id, url)
    if (saveErr) { toast(saveErr); setBusyId(null); return }
    setPlaces((ps) => ps.map((p) => (p.id === place.id ? { ...p, cover_image: url } : p)))
    // 새 URL이니 이전에 깨졌던 기록은 지운다
    setBrokenIds((b) => { const next = { ...b }; delete next[place.id]; return next })
    toast(`${place.name} 대표 이미지를 저장했어요`)
    setBusyId(null)
  }

  async function onRemove(place: Place) {
    if (!confirm(`"${place.name}"의 대표 이미지를 지울까요?\n\n장소 카드에서 이미지가 사라집니다.`)) return
    setBusyId(place.id)
    const err = await saveCover(place.id, null)
    // 실패하면 화면 상태를 건드리지 않는다 — 이미지는 그대로 남는다
    if (err) { toast(err); setBusyId(null); return }
    setPlaces((ps) => ps.map((p) => (p.id === place.id ? { ...p, cover_image: null } : p)))
    setBrokenIds((b) => { const next = { ...b }; delete next[place.id]; return next })
    toast(`${place.name} 대표 이미지를 지웠어요`)
    setBusyId(null)
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <div>
          <h1 className={styles.h1}>장소 관리</h1>
          <p className={styles.headSub}>장소 카드에 표시할 대표 이미지를 관리하세요</p>
          <p className={styles.headHint}>권장 비율 16:11 · 가로형 고해상도 이미지를 사용하세요</p>
        </div>
        <span className={styles.counter}>
          이미지 등록
          <span className={styles.counterNum}>
            {loading ? '—' : `${counts.has} / ${counts.all}`}
          </span>
        </span>
      </div>

      <div className={styles.summary}>
        <Stat label="전체 장소" value={counts.all} loading={loading} icon="place" iconClass={styles.iconNeutral} />
        <Stat label="이미지 있음" value={counts.has} loading={loading} icon="checkCircle" iconClass={styles.iconGreen} toneClass={styles.toneGreen} />
        <Stat label="이미지 필요" value={counts.need} loading={loading} icon="imageAlert" iconClass={styles.iconAmber} toneClass={styles.toneAmber} />
      </div>

      <div className={`${styles.card} ${styles.toolbar}`}>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}><AdminIcon name="search" size={18} /></span>
          <input
            className={styles.search}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="장소명 또는 주소 검색"
            aria-label="장소명 또는 주소 검색"
          />
        </div>

        <div className={styles.chips}>
          {([
            { value: 'all', label: '전체', count: counts.all },
            { value: 'has', label: '이미지 있음', count: counts.has },
            { value: 'need', label: '이미지 필요', count: counts.need },
          ] as { value: CoverFilter; label: string; count: number }[]).map((f) => (
            <button
              key={f.value}
              type="button"
              className={filter === f.value ? `${styles.chip} ${styles.chipOn}` : styles.chip}
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
            >
              {f.label}<span className={styles.chipCount}>{f.count}</span>
            </button>
          ))}
        </div>

        <select className={styles.select} value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="정렬 기준">
          {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>

        <span className={styles.total}>{filtered.length.toLocaleString()}개 표시</span>
      </div>

      {loading ? (
        <div className={styles.grid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`${styles.card} ${styles.skelCard}`}>
              <div className={`${styles.skel} ${styles.skelThumb}`} />
              <div className={styles.body}>
                <div className={styles.skel} style={{ width: '55%', height: 14, borderRadius: 6, marginBottom: 8 }} />
                <div className={styles.skel} style={{ width: '80%', height: 12, borderRadius: 6 }} />
                <div className={styles.skel} style={{ width: '100%', height: 44, borderRadius: 8, marginTop: 11 }} />
              </div>
            </div>
          ))}
        </div>
      ) : failed ? (
        <div className={`${styles.card} ${styles.state}`}>
          <strong className={styles.stateStrong}>장소를 불러오지 못했어요</strong>
          잠시 후 다시 시도해 주세요.
          <div>
            <button type="button" className={styles.retryBtn} onClick={() => setReloadKey((k) => k + 1)}>다시 불러오기</button>
          </div>
        </div>
      ) : places.length === 0 ? (
        <div className={`${styles.card} ${styles.state}`}>
          <strong className={styles.stateStrong}>등록된 장소가 없어요</strong>
          장소가 추가되면 여기에서 대표 이미지를 관리할 수 있어요.
        </div>
      ) : filtered.length === 0 ? (
        <div className={`${styles.card} ${styles.state}`}>
          <strong className={styles.stateStrong}>조건에 맞는 장소가 없어요</strong>
          검색어나 필터를 바꿔보세요.
        </div>
      ) : (
        <>
          <div className={styles.grid}>
            {pageItems.map((p) => (
              <PlaceCard
                key={p.id}
                place={p}
                busy={busyId === p.id}
                broken={!!brokenIds[p.id]}
                onBroken={() => setBrokenIds((b) => ({ ...b, [p.id]: true }))}
                onPick={(f) => onPick(p, f)}
                onRemove={() => onRemove(p)}
              />
            ))}
          </div>

          <div className={styles.pager}>
            <span className={styles.range}>
              {(from + 1).toLocaleString()}–{Math.min(from + PAGE_SIZE, filtered.length).toLocaleString()} / {filtered.length.toLocaleString()}
            </span>
            <Pager page={safePage} totalPages={totalPages} onChange={setPage} />
          </div>
        </>
      )}

      {msg && <div className={styles.toast} role="status">{msg}</div>}
    </div>
  )
}

function PlaceCard({ place, busy, broken, onBroken, onPick, onRemove }: {
  place: Place
  busy: boolean
  broken: boolean
  onBroken: () => void
  onPick: (f: File) => void
  onRemove: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  const inputId = useId()
  const url = coverUrl(place)
  const showImage = url !== null && !broken

  return (
    <div className={`${styles.card} ${styles.placeCard}`}>
      {/* 숨은 input + label 조합. label을 누르면 파일 선택창이 열리고,
          키보드는 아래 '이미지 추가/교체' 버튼(Enter·Space)으로 연다. */}
      <input
        ref={ref}
        id={inputId}
        type="file"
        accept="image/*"
        className={styles.fileInput}
        tabIndex={-1}
        disabled={busy}
        aria-label={`${place.name} 대표 이미지 파일 선택`}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onPick(f)
          e.target.value = ''   // 같은 파일을 다시 골라도 change가 뜨도록 비운다
        }}
      />
      <label
        htmlFor={inputId}
        className={busy ? `${styles.thumb} ${styles.thumbBusy}` : styles.thumb}
      >
        {showImage ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={`${place.name} 대표 이미지`} onError={onBroken} />
            <span className={styles.badge}>
              <AdminIcon name="checkCircle" size={13} />등록 완료
            </span>
          </>
        ) : (
          <span className={broken ? `${styles.thumbEmpty} ${styles.thumbBroken}` : styles.thumbEmpty}>
            <AdminIcon name={broken ? 'imageAlert' : 'image'} size={30} className={styles.thumbEmptyIcon} />
            <span className={styles.thumbEmptyTitle}>
              {broken ? '이미지를 불러올 수 없습니다' : '대표 이미지가 없습니다'}
            </span>
            <span className={styles.thumbEmptyHint}>16:11 권장</span>
          </span>
        )}
        {busy && <span className={styles.overlay}>올리는 중…</span>}
      </label>

      <div className={styles.body}>
        <span className={styles.name} title={place.name}>{place.name}</span>
        <span className={styles.addr} title={place.addr ?? '주소 없음'}>{place.addr ?? '주소 없음'}</span>

        <div className={styles.actions}>
          <button
            type="button"
            className={url ? `${styles.addBtn} ${styles.replaceBtn}` : styles.addBtn}
            onClick={() => ref.current?.click()}
            disabled={busy}
          >
            <AdminIcon name="image" size={16} />
            {busy ? '올리는 중…' : url ? '이미지 교체' : '이미지 추가'}
          </button>
          {url && (
            <button type="button" className={styles.deleteBtn} onClick={onRemove} disabled={busy}>
              이미지 삭제
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, loading, icon, iconClass, toneClass }: {
  label: string; value: number; loading: boolean
  icon: AdminIconName; iconClass: string; toneClass?: string
}) {
  return (
    <div className={`${styles.card} ${styles.stat}`}>
      <span className={styles.statBody}>
        <span className={styles.statLabel}>{label}</span>
        <span className={`${styles.statValue} ${toneClass ?? ''}`}>
          {loading ? '—' : value.toLocaleString()}
        </span>
      </span>
      <span className={`${styles.statIcon} ${iconClass}`}><AdminIcon name={icon} size={20} /></span>
    </div>
  )
}

function Pager({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null
  const nums: (number | 'gap')[] = []
  for (let i = 0; i < totalPages; i++) {
    if (i === 0 || i === totalPages - 1 || Math.abs(i - page) <= 1) nums.push(i)
    else if (nums[nums.length - 1] !== 'gap') nums.push('gap')
  }
  return (
    <div className={styles.pageBtns}>
      <button type="button" className={styles.pageBtn} disabled={page === 0} onClick={() => onChange(page - 1)} aria-label="이전 페이지">‹</button>
      {nums.map((n, i) => n === 'gap'
        ? <span key={`g${i}`} className={styles.gap}>…</span>
        : (
          <button
            key={n}
            type="button"
            className={n === page ? `${styles.pageBtn} ${styles.pageOn}` : styles.pageBtn}
            aria-current={n === page ? 'page' : undefined}
            aria-label={`${n + 1}페이지`}
            onClick={() => onChange(n)}
          >{n + 1}</button>
        ))}
      <button type="button" className={styles.pageBtn} disabled={page >= totalPages - 1} onClick={() => onChange(page + 1)} aria-label="다음 페이지">›</button>
    </div>
  )
}
