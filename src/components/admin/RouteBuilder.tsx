'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useAuth } from '@/components/layout/AuthProvider'
import { getAllTagsFull, AdminTag } from '@/services/workAdminService'
import { getShopsByTag, getShops, getSavedShops } from '@/services/shopService'
import { createRoute, getRouteForEdit, updateRoute, getRouteStats, uploadRouteCover, updateRouteMeta, getRouteMeta } from '@/services/routeService'
import { approveOfficialRoute } from '@/services/adminRouteService'
import { shopRegion } from '@/lib/shop/quickCompleteness'
import { Shop } from '@/types/shop'
import RouteMiniMap from './RouteMiniMap'

const DIFF = [{ v: 1, l: '가볍게' }, { v: 2, l: '반나절' }, { v: 3, l: '하루' }]
const SEASONS = ['봄', '여름', '가을', '겨울']
const THEMES = ['카페', '굿즈', '사진명소', '가족', '커플', '혼자', '도보30분', '반나절', '실내', '비오는날']
type SourceMode = 'work' | 'region' | 'saved'

export default function RouteBuilder({ editRouteId, onDone, onCancel }: { editRouteId?: string | null; onDone: () => void; onCancel: () => void }) {
  const { user } = useAuth()
  const editing = !!editRouteId
  const [sourceMode, setSourceMode] = useState<SourceMode>('work')
  const [tags, setTags] = useState<AdminTag[]>([])
  const [tagQuery, setTagQuery] = useState('')
  const [selectedTag, setSelectedTag] = useState<AdminTag | null>(null)
  const [candidates, setCandidates] = useState<Shop[]>([])
  const [loadingShops, setLoadingShops] = useState(false)
  const [query, setQuery] = useState('')
  const [added, setAdded] = useState<Shop[]>([])
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [loadingEdit, setLoadingEdit] = useState(editing)
  const [stats, setStats] = useState<{ likes: number; shareToken: string | null; cover: string | null; completions: number } | null>(null)

  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [difficulty, setDifficulty] = useState(1)
  const [coverUrl, setCoverUrl] = useState('')
  const [season, setSeason] = useState('')
  const [themes, setThemes] = useState<string[]>([])
  const [target, setTarget] = useState('')
  const [uploading, setUploading] = useState(false)
  const [primaryTagId, setPrimaryTagId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => { getAllTagsFull().then(setTags).catch(() => {}) }, [])

  useEffect(() => {
    if (!editRouteId) return
    getRouteForEdit(editRouteId).then((r) => {
      if (r) {
        setTitle(r.title ?? ''); setDesc(r.description ?? ''); setDifficulty(r.official_difficulty ?? 1)
        const shops = (r.route_shops ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order).map((rs: any) => rs.shops).filter((s: any) => s && s.lat != null && s.lng != null)
        setAdded(shops as Shop[])
      }
      setLoadingEdit(false)
    })
    getRouteStats(editRouteId).then(setStats).catch(() => {})
    getRouteMeta(editRouteId).then((m) => { setCoverUrl(m.cover ?? ''); setSeason(m.season ?? ''); setThemes(m.themes ?? []); setTarget(m.target ?? ''); setPrimaryTagId((m as any).primaryTag ?? null) }).catch(() => {})
  }, [editRouteId])

  function switchMode(m: SourceMode) {
    if (m === sourceMode) return
    setSourceMode(m); setQuery(''); setSelectedTag(null); setCandidates([])
  }

  useEffect(() => {
    if (sourceMode === 'work') return
    if (candidates.length > 0 || loadingShops) return
    setLoadingShops(true)
    const p = sourceMode === 'region' ? getShops() : (user ? getSavedShops(user.id) : Promise.resolve([]))
    p.then((shops) => setCandidates((shops as Shop[]).filter((s) => s.lat != null && s.lng != null)))
      .catch(() => setCandidates([]))
      .finally(() => setLoadingShops(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceMode])

  async function pickTag(t: AdminTag) {
    setSelectedTag(t); setTagQuery(''); setQuery(''); setLoadingShops(true)
    if (!title) setTitle(`${t.name} 코스`)
    setPrimaryTagId(t.id)
    const shops = await getShopsByTag(t.slug).catch(() => [])
    setCandidates(shops.filter((s) => s.lat != null && s.lng != null))
    setLoadingShops(false)
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setUploading(true)
    const url = await uploadRouteCover(file, user.id, editRouteId ?? 'new')
    setUploading(false)
    if (url) setCoverUrl(url); else setMsg('이미지 업로드 실패')
    if (fileRef.current) fileRef.current.value = ''
  }
  function toggleTheme(t: string) { setThemes((a) => a.includes(t) ? a.filter((x) => x !== t) : [...a, t]) }

  const q = query.trim().toLowerCase()
  const filtered = useMemo(() => {
    if (!q) return candidates
    return candidates.filter((s) => (s.name ?? '').toLowerCase().includes(q) || (s.addr ?? '').toLowerCase().includes(q) || shopRegion(s).toLowerCase().includes(q))
  }, [candidates, q])
  const addedIds = useMemo(() => new Set(added.map((s) => s.id)), [added])

  function add(s: Shop) { if (!addedIds.has(s.id)) setAdded((a) => [...a, s]) }
  function addAll() { setAdded((a) => { const ids = new Set(a.map((x) => x.id)); return [...a, ...filtered.filter((s) => !ids.has(s.id))] }) }
  function remove(id: string) { setAdded((a) => a.filter((s) => s.id !== id)) }
  function move(i: number, dir: -1 | 1) {
    setAdded((a) => { const j = i + dir; if (j < 0 || j >= a.length) return a; const c = [...a]; [c[i], c[j]] = [c[j], c[i]]; return c })
  }
  function moveTo(target2: number) {
    setAdded((a) => { if (dragIndex == null || dragIndex === target2) return a; const c = [...a]; const [m] = c.splice(dragIndex, 1); c.splice(target2, 0, m); return c })
    setDragIndex(null)
  }

  const tagMatches = tagQuery.trim() ? tags.filter((t) => t.name.includes(tagQuery.trim())).slice(0, 8) : []
  const mapStops = useMemo(() => added.map((s) => ({ id: s.id, lat: s.lat as number, lng: s.lng as number, name: s.name })), [added])
  const showCandidates = sourceMode !== 'work' || !!selectedTag

  const checks = [
    { label: '루트 이름', ok: !!title.trim() },
    { label: '설명', ok: !!desc.trim() },
    { label: '샵 2곳 이상', ok: added.length >= 2 },
    { label: '대표 이미지', ok: !!coverUrl },
  ]
  const donePct = Math.round((checks.filter((c) => c.ok).length / checks.length) * 100)
  const pctColor = donePct >= 75 ? 'var(--green)' : donePct >= 50 ? 'var(--secondary)' : 'var(--red)'

  async function save() {
    if (!user) return
    if (!title.trim()) { setMsg('루트 이름을 입력하세요'); return }
    if (added.length < 2) { setMsg('샵을 2개 이상 담아주세요'); return }
    setSaving(true); setMsg(null)
    const shopInput = added.map((s) => ({ shopId: s.id, lat: s.lat as number, lng: s.lng as number }))
    const meta = { cover_image_url: coverUrl || null, season: season || null, themes, target_audience: target || null, primary_tag_id: primaryTagId }
    if (editing && editRouteId) {
      const ok = await updateRoute(editRouteId, title.trim(), desc.trim(), difficulty, shopInput)
      if (ok) await updateRouteMeta(editRouteId, meta)
      setSaving(false); if (ok) onDone(); else setMsg('수정 저장 실패')
    } else {
      const res = await createRoute(user.id, title.trim(), desc.trim(), shopInput)
      if (!res) { setSaving(false); setMsg('루트 생성 실패'); return }
      await approveOfficialRoute(res.id, difficulty, user.id)
      await updateRouteMeta(res.id, meta)
      setSaving(false); onDone()
    }
  }

  if (loadingEdit) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>루트 불러오는 중...</div>

  const searchPlaceholder = sourceMode === 'saved' ? '저장한 샵에서 검색 (이름·지역)' : '지역·이름 검색 (예: 홍대, 강남)'

  return (
    <div style={{ border: '1px solid var(--accent)', borderRadius: 14, padding: 16, marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 style={{ fontSize: 16, fontWeight: 900, margin: 0 }}>{editing ? '루트 수정' : '새 공식 루트 만들기'}</h3>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}>취소 ✕</button>
      </div>

      {editing && (
        <div style={{ background: 'var(--surface2)', borderRadius: 12, padding: 14, marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--muted)' }}>완성도</span>
            <span style={{ fontSize: 16, fontWeight: 900, color: pctColor }}>{donePct}%</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            {checks.map((c) => (
              <span key={c.label} style={{ fontSize: 12, fontWeight: 700, padding: '4px 9px', borderRadius: 9999, background: 'var(--surface)', color: c.ok ? 'var(--green)' : 'var(--muted)', border: `1px solid ${c.ok ? 'var(--green)' : 'var(--border)'}` }}>{c.ok ? '✓' : '○'} {c.label}</span>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
            <Stat label="좋아요" v={stats?.likes ?? 0} />
            <Stat label="완주" v={stats?.completions ?? 0} />
            <Stat label="샵" v={added.length} />
          </div>
          {stats?.shareToken && (
            <a href={`/route/${stats.shareToken}`} target="_blank" rel="noreferrer" style={{ display: 'inline-block', padding: '8px 13px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>🌐 사이트에서 보기</a>
          )}
          <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10 }}>평점·리뷰, 인기 순위는 사용자 데이터가 쌓이면 표시돼요.</p>
        </div>
      )}

      <Label>샵 불러오기 방식</Label>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        <button onClick={() => switchMode('work')} style={modeBtn(sourceMode === 'work')}>작품별</button>
        <button onClick={() => switchMode('region')} style={modeBtn(sourceMode === 'region')}>지역별</button>
        <button onClick={() => switchMode('saved')} style={modeBtn(sourceMode === 'saved')}>저장한 샵</button>
      </div>

      {sourceMode === 'work' && (
        <>
          <Label>작품 선택</Label>
          {selectedTag ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontWeight: 800 }}>🎬 {selectedTag.name}</span>
              <button onClick={() => { setSelectedTag(null); setCandidates([]) }} style={miniBtn}>변경</button>
            </div>
          ) : (
            <div style={{ position: 'relative', marginBottom: 12 }}>
              <input value={tagQuery} onChange={(e) => setTagQuery(e.target.value)} placeholder="작품 이름 검색" style={inp} />
              {tagMatches.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, marginTop: 4, overflow: 'hidden' }}>
                  {tagMatches.map((t) => (
                    <button key={t.id} onClick={() => pickTag(t)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, color: 'var(--text)' }}>{t.name}</button>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {showCandidates && (
        <>
          <Label>{sourceMode === 'saved' ? '저장한 샵' : '샵 검색'}</Label>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={searchPlaceholder} style={{ ...inp, marginBottom: 10 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{loadingShops ? '불러오는 중...' : `${filtered.length}개 샵`}</span>
            {filtered.length > 0 && <button onClick={addAll} style={miniBtn}>전체 담기</button>}
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 16 }}>
            {filtered.map((s) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{shopRegion(s)}</div>
                </div>
                <button onClick={() => add(s)} disabled={addedIds.has(s.id)} style={{ ...miniBtn, opacity: addedIds.has(s.id) ? 0.4 : 1 }}>{addedIds.has(s.id) ? '담김' : '담기'}</button>
              </div>
            ))}
            {!loadingShops && filtered.length === 0 && <div style={{ padding: 16, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>{sourceMode === 'saved' ? '저장한 샵이 없어요' : '검색 결과가 없어요'}</div>}
          </div>
        </>
      )}

      {added.length >= 2 && (
        <>
          <Label>지도 미리보기</Label>
          <div style={{ marginBottom: 16 }}><RouteMiniMap stops={mapStops} /></div>
        </>
      )}

      <Label>루트 순서 ({added.length}) · 드래그로 이동</Label>
      {added.length === 0 ? (
        <div style={{ padding: 16, textAlign: 'center', color: 'var(--muted)', fontSize: 13, border: '1px dashed var(--border)', borderRadius: 10, marginBottom: 16 }}>위에서 샵을 담아주세요</div>
      ) : (
        <div style={{ marginBottom: 16 }}>
          {added.map((s, i) => (
            <div key={s.id} draggable onDragStart={() => setDragIndex(i)} onDragOver={(e) => e.preventDefault()} onDrop={() => moveTo(i)} onDragEnd={() => setDragIndex(null)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 4px', borderBottom: '1px solid var(--border)', background: dragIndex === i ? 'var(--surface2)' : 'transparent', cursor: 'grab' }}>
              <span style={{ color: 'var(--muted)', fontSize: 15, cursor: 'grab' }}>≡</span>
              <span style={{ width: 22, height: 22, borderRadius: 9999, background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span>
              <button onClick={() => move(i, -1)} disabled={i === 0} style={{ ...miniBtn, opacity: i === 0 ? 0.3 : 1 }}>↑</button>
              <button onClick={() => move(i, 1)} disabled={i === added.length - 1} style={{ ...miniBtn, opacity: i === added.length - 1 ? 0.3 : 1 }}>↓</button>
              <button onClick={() => remove(s.id)} style={{ ...miniBtn, color: 'var(--red)' }}>✕</button>
            </div>
          ))}
        </div>
      )}

      <Label>루트 이름</Label>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 홍대 원피스 굿즈 투어" style={{ ...inp, marginBottom: 10 }} />
      <Label>설명</Label>
      <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="루트 소개 (선택)" style={{ ...inp, minHeight: 60, marginBottom: 10, resize: 'vertical' }} />

      <Label>대표 이미지</Label>
      <div style={{ marginBottom: 12 }}>
        <div style={{ height: 140, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', background: coverUrl ? 'transparent' : 'linear-gradient(135deg, var(--accent), #ff8fb1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
          {coverUrl ? <img src={coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: '#fff', fontWeight: 800 }}>대표 이미지 없음</span>}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="이미지 URL 또는 업로드" style={{ ...inp, flex: 1 }} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ ...miniBtn, padding: '0 14px' }}>{uploading ? '업로드 중...' : '업로드'}</button>
          {coverUrl && <button onClick={() => setCoverUrl('')} style={{ ...miniBtn, color: 'var(--red)' }}>제거</button>}
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={onPickFile} style={{ display: 'none' }} />
      </div>

      <Label>시즌 추천 (선택)</Label>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {SEASONS.map((s) => (
          <button key={s} onClick={() => setSeason(season === s ? '' : s)} style={chip(season === s)}>{s}</button>
        ))}
      </div>

      <Label>테마 (여러 개 선택 가능)</Label>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {THEMES.map((t) => (
          <button key={t} onClick={() => toggleTheme(t)} style={chip(themes.includes(t))}>{t}</button>
        ))}
      </div>

      <Label>추천 대상 (선택)</Label>
      <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="예: 입문자, 커플, 사진 좋아하는 사람" style={{ ...inp, marginBottom: 12 }} />

      <Label>난이도</Label>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {DIFF.map((d) => (
          <button key={d.v} onClick={() => setDifficulty(d.v)} style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${difficulty === d.v ? 'var(--accent)' : 'var(--border)'}`, background: difficulty === d.v ? 'var(--accent)' : 'var(--surface)', color: difficulty === d.v ? '#fff' : 'var(--text)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>{d.l}</button>
        ))}
      </div>

      <button onClick={save} disabled={saving} style={{ width: '100%', padding: 13, borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>
        {saving ? '저장 중...' : editing ? '수정 저장 (거리·시간 재계산)' : '공식 루트로 저장 (거리·시간 자동계산)'}
      </button>
      {msg && <p style={{ fontSize: 13, textAlign: 'center', marginTop: 10, color: 'var(--red)' }}>{msg}</p>}
    </div>
  )
}

const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', fontFamily: 'inherit', fontSize: 14, background: 'var(--surface)', color: 'var(--text)' }
const miniBtn: React.CSSProperties = { padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }
function modeBtn(active: boolean): React.CSSProperties {
  return { flex: 1, padding: '9px', borderRadius: 10, border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, background: active ? 'var(--accent)' : 'var(--surface)', color: active ? '#fff' : 'var(--text)', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }
}
function chip(active: boolean): React.CSSProperties {
  return { padding: '7px 13px', borderRadius: 9999, border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, background: active ? 'var(--accent)' : 'var(--surface)', color: active ? '#fff' : 'var(--text)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }
}
function Label({ children }: { children: React.ReactNode }) { return <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', marginBottom: 6 }}>{children}</div> }
function Stat({ label, v }: { label: string; v: number }) {
  return <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '10px 4px', textAlign: 'center', background: 'var(--surface)' }}><div style={{ fontSize: 18, fontWeight: 900 }}>{v.toLocaleString()}</div><div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{label}</div></div>
}
