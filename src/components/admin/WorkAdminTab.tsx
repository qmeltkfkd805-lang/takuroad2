'use client'
import { useState, useEffect, useMemo, useRef, CSSProperties, ReactNode, RefObject } from 'react'
import WorkRegister from '@/components/work/WorkRegister'
import Link from 'next/link'
import { getAllTagsFull, uploadWorkImage, AdminTag } from '@/services/workAdminService'
import { adminUpsert } from '@/services/adminUpsertService'
import WorkHubPanel from './WorkHubPanel'
import { Button } from '@/components/tds/Button'
import AdminIcon from './AdminIcon'
import styles from './workAdmin.module.css'

const IP_TYPES = [
  { value: '', label: '(미지정)' },
  { value: 'anime', label: '애니메이션' },
  { value: 'game', label: '게임' },
  { value: 'franchise', label: '프랜차이즈' },
  { value: 'character_brand', label: '캐릭터 브랜드' },
  { value: 'designer_toy', label: '디자이너 토이' },
  { value: 'vtuber', label: '버튜버' },
]

const KEY_FIELDS: (keyof AdminTag)[] = ['english_name', 'ip_type', 'release_year', 'genres', 'description', 'cover_url', 'banner_image']

function completeness(t: AdminTag): number {
  return KEY_FIELDS.filter((f) => {
    const v = t[f]
    if (Array.isArray(v)) return v.length > 0
    return v !== null && v !== undefined && v !== ''
  }).length
}

interface FormState { name: string; english_name: string; slug: string; ip_type: string; release_year: string; genresText: string; description: string; cover_url: string; banner_image: string }

function toForm(t: AdminTag): FormState {
  return {
    name: t.name ?? '', english_name: t.english_name ?? '', slug: t.slug ?? '',
    ip_type: t.ip_type ?? '', release_year: t.release_year != null ? String(t.release_year) : '',
    genresText: (t.genres ?? []).join(', '), description: t.description ?? '',
    cover_url: t.cover_url ?? '', banner_image: t.banner_image ?? '',
  }
}

const inputStyle: CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', fontFamily: 'inherit', fontSize: 14, background: 'var(--surface)', color: 'var(--text)' }

const BLANK_TAG = { id: '', name: '', slug: '', english_name: '', ip_type: '', release_year: null, genres: [], description: '', cover_url: '', banner_image: '' } as unknown as AdminTag

/* 7개 항목의 한글 이름 — 어떤 게 빠졌는지 보여주기 위한 것.
   KEY_FIELDS와 짝이 맞아야 하므로 키를 그대로 쓴다. */
const FIELD_LABEL: Record<string, string> = {
  english_name: '영문명', ip_type: 'IP 유형', release_year: '출시연도',
  genres: '장르', description: '소개', cover_url: '커버 이미지', banner_image: '배너 이미지',
}

function missingFields(t: AdminTag): string[] {
  return KEY_FIELDS.filter((f) => {
    const v = t[f]
    if (Array.isArray(v)) return v.length === 0
    return v === null || v === undefined || v === ''
  }).map((f) => FIELD_LABEL[f as string] ?? String(f))
}

const PAGE_SIZE = 50
const TOTAL_FIELDS = KEY_FIELDS.length   // 7

type Filter = 'all' | 'complete' | 'incomplete'
type Sort = 'name' | 'created_desc' | 'meta_asc' | 'meta_desc' | 'year_desc'

const SORTS: { v: Sort; label: string }[] = [
  { v: 'name', label: '작품명 가나다순' },
  { v: 'created_desc', label: '최근 등록순' },
  { v: 'meta_asc', label: '완성도 낮은 순' },
  { v: 'meta_desc', label: '완성도 높은 순' },
  { v: 'year_desc', label: '출시연도 최신순' },
]

export default function WorkAdminTab() {
  const [tags, setTags] = useState<AdminTag[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('name')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<AdminTag | null>(null)
  const listRef = useRef<HTMLElement>(null)

  /* setState는 전부 then/catch 콜백 안에 둔다 — effect 본문에서 동기로 부르면
     렌더가 한 번 더 돈다(react-hooks/set-state-in-effect). */
  useEffect(() => {
    let alive = true
    getAllTagsFull()
      .then((data) => { if (!alive) return; setTags(data); setLoadError(false) })
      .catch((e) => { if (!alive) return; console.error('[작품 관리] 목록 조회 실패:', e); setLoadError(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [reloadKey])

  function retry() { setLoading(true); setLoadError(false); setReloadKey((k) => k + 1) }

  // 요약 3칸 — 이미 메모리에 있는 데이터로만 계산한다 (추가 조회 없음)
  const summary = useMemo(() => {
    let complete = 0
    for (const t of tags) if (completeness(t) === TOTAL_FIELDS) complete++
    return { total: tags.length, complete, incomplete: tags.length - complete }
  }, [tags])

  /* 전체 데이터 → 검색 → 완성도 필터 → 정렬. 페이지 자르기는 아래에서 따로 한다.
     ⭐ 검색·필터·정렬은 항상 "현재 페이지"가 아니라 전체 데이터에 적용된다. */
  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    let out = q
      ? tags.filter((t) =>
        t.name.toLowerCase().includes(q)
        || (t.english_name ?? '').toLowerCase().includes(q)
        || t.slug.toLowerCase().includes(q))
      : tags

    if (filter !== 'all') {
      out = out.filter((t) => (completeness(t) === TOTAL_FIELDS) === (filter === 'complete'))
    }

    const sorted = [...out]
    if (sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name, 'ko'))
    else if (sort === 'created_desc') sorted.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
    else if (sort === 'meta_asc') sorted.sort((a, b) => completeness(a) - completeness(b) || a.name.localeCompare(b.name, 'ko'))
    else if (sort === 'meta_desc') sorted.sort((a, b) => completeness(b) - completeness(a) || a.name.localeCompare(b.name, 'ko'))
    else if (sort === 'year_desc') sorted.sort((a, b) => (b.release_year ?? -Infinity) - (a.release_year ?? -Infinity) || a.name.localeCompare(b.name, 'ko'))
    return sorted
  }, [tags, query, filter, sort])

  /* 검색어·필터·정렬이 바뀌면 1페이지로. effect가 아니라 렌더 중 파생 상태 조정으로 처리한다 */
  const listKey = `${query}|${filter}|${sort}`
  const [prevKey, setPrevKey] = useState(listKey)
  if (listKey !== prevKey) { setPrevKey(listKey); setPage(1) }

  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE))
  const safePage = Math.min(Math.max(page, 1), totalPages)   // 범위를 벗어나면 마지막 페이지로 보정
  const from = (safePage - 1) * PAGE_SIZE
  const rows = list.slice(from, from + PAGE_SIZE)            // 현재 페이지 항목만 렌더

  function goPage(n: number) {
    setPage(Math.min(Math.max(n, 1), totalPages))
    // 브라우저 전체가 튀지 않게 목록 영역 기준으로만 올린다
    listRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }

  // 편집 화면 — 기존 흐름(setSelected → WorkRegister) 그대로.
  // 이 컴포넌트는 언마운트되지 않으므로 검색·필터·정렬·페이지 상태가 그대로 남는다.
  if (selected) return (
    <div className={styles.wrap}>
      <button onClick={() => setSelected(null)} className={styles.backBtn}>
        <AdminIcon name="chevron" size={16} style={{ transform: 'rotate(180deg)' }} />목록으로
      </button>
      <WorkRegister mode={selected.id ? 'edit' : 'create'} editId={selected.id || null} />
    </div>
  )

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.h1}>작품 관리</h1>
          <p className={styles.headSub}>등록된 작품과 메타데이터 상태를 관리하세요</p>
        </div>
        <button type="button" className={styles.primaryBtn} onClick={() => setSelected(BLANK_TAG)}>
          <AdminIcon name="doc" size={17} />새 작품 추가
        </button>
      </header>

      {/* 요약 — 로딩 전에는 '—' */}
      <div className={styles.summary}>
        <Stat icon="doc" tone="iconPink" label="전체 작품" value={loading ? null : summary.total} />
        <Stat icon="checkCircle" tone="iconGreen" label="정보 완성" value={loading ? null : summary.complete} />
        <Stat icon="alert" tone="iconAmber" label="보완 필요" value={loading ? null : summary.incomplete} />
      </div>

      <section className={styles.card} ref={listRef}>
        {/* 검색 · 필터 · 정렬 */}
        <div className={styles.toolbar}>
          <div className={styles.searchWrap}>
            <span className={styles.searchIcon}><AdminIcon name="search" size={18} /></span>
            <input
              className={styles.search}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="작품명, 영문명 또는 slug 검색"
              aria-label="작품 검색 (작품명, 영문명, slug)"
              type="search"
            />
          </div>

          <div className={styles.filterRow}>
            <div className={styles.chips} role="group" aria-label="완성도 필터">
              {([['all', '전체'], ['complete', `완성 ${TOTAL_FIELDS}/${TOTAL_FIELDS}`], ['incomplete', '보완 필요']] as const).map(([k, t]) => (
                <button key={k} type="button" aria-pressed={filter === k}
                  className={`${styles.chip} ${filter === k ? styles.chipOn : ''}`}
                  onClick={() => setFilter(k)}>{t}</button>
              ))}
            </div>

            <div className={styles.rightTools}>
              <select className={styles.sort} value={sort} aria-label="정렬 기준"
                onChange={(e) => setSort(e.target.value as Sort)}>
                {SORTS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
              </select>
              {!loading && !loadError && <span className={styles.total}>총 {list.length.toLocaleString()}개</span>}
            </div>
          </div>
        </div>

        {/* 목록 */}
        {loading ? (
          <div aria-busy="true" aria-live="polite">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={styles.skelRow}>
                <span className={styles.skel} style={{ width: 48, height: 64 }} />
                <span style={{ flex: 1 }}>
                  <span className={styles.skel} style={{ display: 'block', width: '38%', height: 15, marginBottom: 7 }} />
                  <span className={styles.skel} style={{ display: 'block', width: '22%', height: 12 }} />
                </span>
                <span className={styles.skel} style={{ width: 120, height: 12 }} />
              </div>
            ))}
          </div>
        ) : loadError ? (
          <div className={styles.state} role="alert">
            <strong className={styles.stateStrong}>작품 목록을 불러오지 못했어요</strong>
            잠시 후 다시 시도해 주세요.
            <div><button type="button" className={styles.retryBtn} onClick={retry}>다시 시도</button></div>
          </div>
        ) : tags.length === 0 ? (
          <div className={styles.state}>
            <strong className={styles.stateStrong}>등록된 작품이 없어요</strong>
            오른쪽 위 ‘새 작품 추가’로 첫 작품을 만들어 주세요.
          </div>
        ) : list.length === 0 ? (
          <div className={styles.state}>
            <strong className={styles.stateStrong}>조건에 맞는 작품이 없어요</strong>
            검색어나 필터를 바꿔보세요.
          </div>
        ) : (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">작품</th>
                    <th scope="col" className={styles.colSlug}>Slug</th>
                    <th scope="col" className={styles.colMeta}>메타데이터 완성도</th>
                    <th scope="col" className={styles.colAction}>작업</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => <Row key={t.id} tag={t} onEdit={() => setSelected(t)} />)}
                </tbody>
              </table>
            </div>

            <nav className={styles.pager} aria-label="작품 목록 페이지">
              <span className={styles.range} aria-live="polite">
                {(from + 1).toLocaleString()}–{Math.min(from + PAGE_SIZE, list.length).toLocaleString()} / {list.length.toLocaleString()}
              </span>
              {totalPages > 1 && (
                <span className={styles.pageBtns}>
                  <button type="button" className={styles.pageBtn} onClick={() => goPage(safePage - 1)}
                    disabled={safePage === 1} aria-label="이전 페이지">
                    <AdminIcon name="chevron" size={15} style={{ transform: 'rotate(180deg)' }} />
                  </button>
                  {pageNumbers(safePage, totalPages).map((n, i) =>
                    n === null
                      ? <span key={`gap${i}`} className={styles.gap}>…</span>
                      : (
                        <button key={n} type="button"
                          className={`${styles.pageBtn} ${n === safePage ? styles.pageOn : ''}`}
                          aria-current={n === safePage ? 'page' : undefined}
                          aria-label={`${n}페이지`}
                          onClick={() => goPage(n)}>{n}</button>
                      ))}
                  <button type="button" className={styles.pageBtn} onClick={() => goPage(safePage + 1)}
                    disabled={safePage === totalPages} aria-label="다음 페이지">
                    <AdminIcon name="chevron" size={15} />
                  </button>
                </span>
              )}
            </nav>
          </>
        )}
      </section>
    </div>
  )
}

/* 현재 페이지 주변만 보여준다. 페이지가 적으면 버튼도 적게 */
function pageNumbers(cur: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const out: (number | null)[] = [1]
  const from = Math.max(2, cur - 1)
  const to = Math.min(total - 1, cur + 1)
  if (from > 2) out.push(null)
  for (let n = from; n <= to; n++) out.push(n)
  if (to < total - 1) out.push(null)
  out.push(total)
  return out
}

function Row({ tag, onEdit }: { tag: AdminTag; onEdit: () => void }) {
  const c = completeness(tag)
  const done = c === TOTAL_FIELDS
  const missing = done ? [] : missingFields(tag)
  // 색에만 기대지 않도록 텍스트를 함께 두고, 빠진 항목은 추가 조회 없이 여기서 만든다
  const detail = done
    ? `메타데이터 ${c}/${TOTAL_FIELDS} 완료`
    : `메타데이터 ${c}/${TOTAL_FIELDS} · 빠진 항목: ${missing.join(', ')}`

  return (
    <tr>
      <td className={styles.cellWork}>
        <span className={styles.workCell}>
          <span className={styles.thumb}>
            {tag.cover_url
              ? <img src={tag.cover_url} alt="" loading="lazy" />
              : <AdminIcon name="doc" size={20} />}
          </span>
          <span className={styles.workText}>
            <span className={styles.workName}>{tag.name}</span>
            {tag.english_name && <span className={styles.workEn}>{tag.english_name}</span>}
          </span>
        </span>
      </td>

      <td className={styles.cellSlug}>
        <span className={styles.slug} title={`/${tag.slug}`}>/{tag.slug}</span>
      </td>

      <td className={styles.cellMeta}>
        <span className={styles.metaCell} title={detail}>
          <span className={styles.bar} role="img" aria-label={detail}>
            {Array.from({ length: TOTAL_FIELDS }).map((_, i) => (
              <span key={i} className={`${styles.seg} ${i < c ? (done ? styles.segAll : styles.segDone) : ''}`} />
            ))}
          </span>
          <span className={styles.metaText}>
            <span className={styles.metaCount}>{c}/{TOTAL_FIELDS}</span>
            {' · '}
            <span className={done ? styles.metaOk : styles.metaWarn}>{done ? '완료' : '보완 필요'}</span>
          </span>
        </span>
      </td>

      <td className={styles.cellAction}>
        <button type="button" className={styles.editBtn} onClick={onEdit} aria-label={`${tag.name} 편집`}>
          편집
        </button>
      </td>
    </tr>
  )
}

function Stat({ icon, tone, label, value }: {
  icon: 'doc' | 'checkCircle' | 'alert'; tone: 'iconPink' | 'iconGreen' | 'iconAmber'
  label: string; value: number | null
}) {
  return (
    <div className={`${styles.card} ${styles.stat}`}>
      <span className={styles.statBody}>
        <span className={styles.statLabel}>{label}</span>
        <span className={styles.statValue}>
          {value === null ? <span className={styles.skel} style={{ display: 'inline-block', width: 56, height: 24 }} /> : value.toLocaleString()}
        </span>
      </span>
      <span className={`${styles.statIcon} ${styles[tone]}`}><AdminIcon name={icon} size={20} /></span>
    </div>
  )
}

function WorkEditForm({ tag, onBack, onSaved }: { tag: AdminTag; onBack: () => void; onSaved: (t: AdminTag) => void }) {
  const [form, setForm] = useState<FormState>(toForm(tag))
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [uploading, setUploading] = useState<'cover' | 'banner' | null>(null)
  const coverInput = useRef<HTMLInputElement>(null)
  const bannerInput = useRef<HTMLInputElement>(null)

  function set<K extends keyof FormState>(key: K, value: FormState[K]) { setForm((prev) => ({ ...prev, [key]: value })); setMsg(null) }

  async function handleUpload(kind: 'cover' | 'banner', file: File) {
    setUploading(kind); setMsg(null)
    const url = await uploadWorkImage(file, form.slug, kind)
    setUploading(null)
    if (!url) { setMsg({ type: 'err', text: '업로드 실패 (URL 직접 붙여넣기는 항상 됩니다)' }); return }
    set(kind === 'cover' ? 'cover_url' : 'banner_image', url)
  }

  async function handleSave() {
    setSaving(true); setMsg(null)
    const genres = form.genresText.split(',').map((s) => s.trim()).filter(Boolean)
    const yearNum = form.release_year.trim() === '' ? null : parseInt(form.release_year, 10)
    if (yearNum != null && Number.isNaN(yearNum)) { setSaving(false); setMsg({ type: 'err', text: '출시연도는 숫자만 입력하세요' }); return }
    const fields = {
      name: form.name.trim(), english_name: form.english_name.trim() || null, slug: form.slug.trim(),
      ip_type: form.ip_type || null, release_year: yearNum, genres,
      description: form.description.trim() || null, cover_url: form.cover_url.trim() || null, banner_image: form.banner_image.trim() || null,
    }
    const creating = !tag.id
    if (creating && (!fields.name || !fields.slug)) { setSaving(false); setMsg({ type: 'err', text: '이름과 slug(URL)는 필수예요' }); return }
    const res = await adminUpsert({ table: 'tags', id: tag.id, fields, action: creating ? 'insert' : 'update' })
    setSaving(false)
    if (!res.ok) { setMsg({ type: 'err', text: res.error ?? '저장 실패' }); return }
    setMsg({ type: 'ok', text: '저장됐어요' })
    onSaved(res.row as AdminTag)
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, padding: 0 }}>← 목록</button>
        <Link href={`/work/${form.slug}`} target="_blank" style={{ fontSize: 13, color: 'var(--cyan)', fontWeight: 700 }}>작품홈에서 보기 ↗</Link>
      </div>

      <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', marginBottom: 18, background: form.banner_image ? `center/cover no-repeat url(${form.banner_image})` : 'linear-gradient(135deg, #FF8FB1, #FF5692)', minHeight: 150, display: 'flex', alignItems: 'flex-end', padding: 14, gap: 14 }}>
        <div style={{ width: 92, height: 129, borderRadius: 10, flexShrink: 0, overflow: 'hidden', background: 'rgba(255,255,255,.25)', border: '2px solid rgba(255,255,255,.6)' }}>
          {form.cover_url ? <img src={form.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
        </div>
        <div style={{ color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,.4)' }}>
          <div style={{ fontSize: 17, fontWeight: 900 }}>{form.name || '작품명'}</div>
          {form.english_name && <div style={{ fontSize: 12, opacity: .9 }}>{form.english_name}</div>}
        </div>
      </div>

      {tag.id ? <WorkHubPanel tag={tag} /> : null}
      <Field label="작품명 (한글)"><Input value={form.name} onChange={(v) => set('name', v)} /></Field>
      <Field label="영문명"><Input value={form.english_name} onChange={(v) => set('english_name', v)} /></Field>
      <Field label="slug (URL — 바꾸면 기존 링크가 깨질 수 있어요)"><Input value={form.slug} onChange={(v) => set('slug', v)} /></Field>
      <Field label="IP 유형">
        <select value={form.ip_type} onChange={(e) => set('ip_type', e.target.value)} style={inputStyle}>
          {IP_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Field>
      <Field label="출시연도"><Input value={form.release_year} onChange={(v) => set('release_year', v)} placeholder="예: 2016" /></Field>
      <Field label="장르 (쉼표로 구분)"><Input value={form.genresText} onChange={(v) => set('genresText', v)} placeholder="액션, 판타지, 일상" /></Field>
      <Field label="설명">
        <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={4} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
      </Field>

      <ImageField label="포스터 (cover_url)" value={form.cover_url} onChange={(v) => set('cover_url', v)} onPick={() => coverInput.current?.click()} uploading={uploading === 'cover'} inputRef={coverInput} onFile={(f) => handleUpload('cover', f)} />
      <ImageField label="배너 (banner_image)" value={form.banner_image} onChange={(v) => set('banner_image', v)} onPick={() => bannerInput.current?.click()} uploading={uploading === 'banner'} inputRef={bannerInput} onFile={(f) => handleUpload('banner', f)} />

      {msg && <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: msg.type === 'ok' ? 'var(--green)' : 'var(--red)' }}>{msg.text}</p>}

      <Button variant="primary" fullWidth disabled={saving} onClick={handleSave}>{saving ? '저장 중...' : '저장'}</Button>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  )
}

function Input({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} style={inputStyle} />
}

function ImageField({ label, value, onChange, onPick, uploading, inputRef, onFile }: { label: string; value: string; onChange: (v: string) => void; onPick: () => void; uploading: boolean; inputRef: RefObject<HTMLInputElement | null>; onFile: (f: File) => void }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>{label}</label>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={value} placeholder="이미지 URL" onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
        <button onClick={onPick} disabled={uploading} style={{ flexShrink: 0, padding: '0 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontWeight: 700, fontSize: 13, cursor: uploading ? 'wait' : 'pointer', fontFamily: 'inherit' }}>{uploading ? '업로드 중' : '파일'}</button>
      </div>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }} />
    </div>
  )
}



