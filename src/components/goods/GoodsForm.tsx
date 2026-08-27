'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import SettingsSubShell from '@/components/settings/SettingsSubShell'
import {
  createSharedGoods, updateGoods, getGoodsDetail, addGoodsImages, removeGoodsImage, deleteGoods,
  searchWorks,
  type WorkRef, type GoodsVisibility, type GoodsImageDetail,
} from '@/services/goodsService'

const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
const VIS: { key: GoodsVisibility; label: string }[] = [
  { key: 'public', label: '전체 공개' }, { key: 'followers', label: '팔로워' }, { key: 'private', label: '나만 보기' },
]

const label: React.CSSProperties = { fontSize: 13, fontWeight: 800, color: 'var(--text)', display: 'block', marginBottom: 7 }
const optional: React.CSSProperties = { fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', marginLeft: 6 }
const inputBase: React.CSSProperties = {
  width: '100%', padding: '11px 13px', borderRadius: 10, border: '1px solid var(--border)',
  background: 'var(--surface)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit',
}
const fieldGap = 18

interface Props {
  mode: 'create' | 'edit'
  id?: string
  presetWorkId?: string | null
  presetWorkName?: string | null
}

interface Preview { key: string; url: string; file?: File; existing?: GoodsImageDetail }

export default function GoodsForm({ mode, id, presetWorkId, presetWorkName }: Props) {
  const router = useRouter()

  const [loading, setLoading] = useState(mode === 'edit')

  // 필드
  const [previews, setPreviews] = useState<Preview[]>([])
  const [removedImageIds, setRemovedImageIds] = useState<GoodsImageDetail[]>([])
  const [workId, setWorkId] = useState<string | null>(presetWorkId ?? null)
  const [workName, setWorkName] = useState<string>(presetWorkName ?? '')
  const [workLocked] = useState<boolean>(!!presetWorkId)
  const [goodsTypeId, setGoodsTypeId] = useState<string | null>(null)  // 편집 시 기존 값 보존용
  const [name, setName] = useState(''); const [character, setCharacter] = useState('')
  const [store, setStore] = useState(''); const [purchasedOn, setPurchasedOn] = useState('')
  const [memo, setMemo] = useState('')
  const [visibility, setVisibility] = useState<GoodsVisibility>('public')
  const [manualTags, setManualTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [tagAdding, setTagAdding] = useState(false)
  const [shareContent, setShareContent] = useState('')
  const [showBuyInfo, setShowBuyInfo] = useState(false)

  // 작품 검색
  const [workQuery, setWorkQuery] = useState(''); const [workResults, setWorkResults] = useState<WorkRef[]>([])
  const [workOpen, setWorkOpen] = useState(false)

  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const fileRef = useRef<HTMLInputElement | null>(null)

  // 편집 프리필
  useEffect(() => {
    if (mode !== 'edit' || !id) return
    getGoodsDetail(id).then(d => {
      if (!d) { setErr('굿즈를 찾을 수 없어요'); setLoading(false); return }
      setPreviews(d.images.map(im => ({ key: im.id, url: im.url ?? '', existing: im })))
      setWorkId(d.workId); setWorkName(d.workName ?? '')
      setGoodsTypeId(d.goodsTypeId); setName(d.name ?? ''); setCharacter(d.characterName ?? '')
      setStore(d.store ?? ''); setPurchasedOn(d.purchasedOn ?? '')
      setMemo(d.memo ?? ''); setVisibility(d.visibility)
      setManualTags((d.tags ?? []).filter(Boolean))
      if (d.characterName || d.store || d.purchasedOn) setShowBuyInfo(true)
      setLoading(false)
    }).catch(() => { setErr('불러오기 실패'); setLoading(false) })
  }, [mode, id])

  // 작품 검색 (디바운스)
  useEffect(() => {
    if (workLocked || !workOpen) return
    const t = setTimeout(() => { searchWorks(workQuery).then(setWorkResults).catch(() => setWorkResults([])) }, 250)
    return () => clearTimeout(t)
  }, [workQuery, workOpen, workLocked])

  function onPickFiles(list: FileList | null) {
    if (!list) return
    const add: Preview[] = Array.from(list).slice(0, 10).map(f => ({ key: `${f.name}-${f.size}-${Math.random().toString(36).slice(2, 7)}`, url: URL.createObjectURL(f), file: f }))
    setPreviews(prev => [...prev, ...add])
  }
  function removePreview(pv: Preview) {
    setPreviews(prev => prev.filter(p => p.key !== pv.key))
    if (pv.existing) setRemovedImageIds(prev => [...prev, pv.existing!])
    if (pv.file) URL.revokeObjectURL(pv.url)
  }

  function addTag(raw: string) {
    const t = raw.replace(/^#+/, '').trim().replace(/\s+/g, ' ')
    if (!t || t.length > 30) { setTagInput(''); return }
    setManualTags(prev => {
      const dup = prev.some(x => x.toLowerCase() === t.toLowerCase())
      if (dup || prev.length >= 20) return prev
      return [...prev, t]
    })
    setTagInput('')
  }

  async function onSave() {
    setErr('')
    if (!workId) { setErr('컬렉션(작품)을 선택해주세요'); return }
    if (previews.length === 0) { setErr('사진을 최소 한 장 올려주세요'); return }
    const input = {
      workId, goodsTypeId, name, characterName: character, store, purchasedOn,
      price: null, pricePublic: false, memo, visibility, tags: manualTags,
    }
    setSaving(true)
    try {
      if (mode === 'create') {
        const files = previews.map(p => p.file!).filter(Boolean)
        await createSharedGoods({ ...input, postTitle: name || null, postContent: shareContent }, files)
      } else if (id) {
        await updateGoods(id, input)
        for (const rm of removedImageIds) await removeGoodsImage(rm)
        const newFiles = previews.filter(p => p.file).map(p => p.file!)
        if (newFiles.length) await addGoodsImages(id, newFiles)
      }
      router.replace('/profile/goods')
    } catch (e: any) {
      setErr(e?.message ?? '저장에 실패했어요'); setSaving(false)
    }
  }

  async function onDelete() {
    if (!id) return
    if (!confirm('이 굿즈를 삭제할까요? 되돌릴 수 없어요.')) return
    setSaving(true)
    try { await deleteGoods(id); router.replace('/profile/goods') }
    catch (e: any) { setErr(e?.message ?? '삭제 실패'); setSaving(false) }
  }

  const registerBtn = (
    <button onClick={onSave} disabled={saving}
      style={{ border: 'none', background: 'none', cursor: saving ? 'default' : 'pointer', color: 'var(--accent)', fontFamily: 'inherit', fontSize: 15, fontWeight: 800, opacity: saving ? 0.5 : 1 }}>
      {saving ? '등록 중…' : mode === 'edit' ? '저장' : '등록'}
    </button>
  )

  /* ── 공통: 사진 그리드 ── */
  const photoGrid = (small?: boolean) => (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      {previews.map(pv => (
        <div key={pv.key} style={{ position: 'relative', width: small ? 76 : 96, height: small ? 76 : 96, borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface2)' }}>
          {pv.url ? <img src={pv.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
          <button onClick={() => removePreview(pv)} aria-label="삭제"
            style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 9999, border: 'none', background: 'rgba(0,0,0,0.55)', color: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" {...P}><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
      ))}
      {previews.length < 10 && (
        <button onClick={() => fileRef.current?.click()}
          style={{ width: small ? 76 : 96, height: small ? 76 : 96, borderRadius: 16, border: '1.5px solid var(--border)', background: 'var(--surface2)', color: 'var(--muted)', cursor: 'pointer', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          <svg width="26" height="26" viewBox="0 0 24 24" {...P}><rect x="3" y="6" width="18" height="14" rx="2" /><circle cx="12" cy="13" r="3.4" /><path d="M8 6l1.2-2h5.6L16 6" /></svg>
          {previews.length === 0 && <span style={{ fontSize: 11, fontWeight: 700 }}>{previews.length}/10</span>}
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={e => { onPickFiles(e.target.files); e.target.value = '' }} />
    </div>
  )

  /* ── 공통: 태그 (칩 + "+ 태그 추가") ── */
  const tagField = (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      {manualTags.map(tg => (
        <span key={tg} style={tagChip}>
          #{tg}
          <button type="button" onClick={() => setManualTags(prev => prev.filter(x => x !== tg))} aria-label="태그 삭제" style={tagX}>
            <svg width="10" height="10" viewBox="0 0 24 24" {...P}><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </span>
      ))}
      {tagAdding ? (
        <input
          autoFocus value={tagInput}
          onChange={e => setTagInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagInput) }
            else if (e.key === 'Backspace' && !tagInput && manualTags.length) { setManualTags(prev => prev.slice(0, -1)) }
          }}
          onBlur={() => { if (tagInput.trim()) addTag(tagInput); setTagAdding(false) }}
          maxLength={30} placeholder="태그 입력 후 Enter"
          style={{ ...inputBase, width: 160, padding: '7px 12px', borderRadius: 9999, borderColor: 'var(--accent)' }}
        />
      ) : (
        <button type="button" onClick={() => setTagAdding(true)}
          style={{ ...tagChip, color: 'var(--accent)', borderColor: 'var(--accent)', background: 'var(--accent-l)', cursor: 'pointer' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" {...P}><path d="M12 5v14M5 12h14" /></svg> 태그 추가
        </button>
      )}
    </div>
  )

  /* ── 공통: 컬렉션(작품) 선택 행 ── */
  const workRow = (
    <div>
      <button type="button" onClick={() => { if (!workLocked) setWorkOpen(o => !o) }} style={rowCard}>
        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>컬렉션 선택</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: workId ? 'var(--accent)' : 'var(--muted)' }}>{workId ? (workName || '선택됨') : '작품 선택'}</span>
          {!workLocked && <svg width="18" height="18" viewBox="0 0 24 24" {...P} style={{ color: 'var(--muted)' }}><path d="m9 18 6-6-6-6" /></svg>}
        </span>
      </button>
      {workOpen && !workLocked && (
        <div style={{ marginTop: 8, position: 'relative' }}>
          <input value={workQuery} onChange={e => setWorkQuery(e.target.value)} placeholder="작품 이름 검색" style={inputBase} autoFocus />
          {workResults.length > 0 && (
            <div style={{ marginTop: 6, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', maxHeight: 240, overflowY: 'auto' }}>
              {workResults.map(w => (
                <button key={w.id} onClick={() => { setWorkId(w.id); setWorkName(w.name); setWorkOpen(false); setWorkQuery('') }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '11px 13px', border: 'none', borderBottom: '1px solid var(--border)', background: 'none', color: 'var(--text)', fontFamily: 'inherit', fontSize: 14, cursor: 'pointer' }}>{w.name}</button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )

  const primaryBtn = (
    <button onClick={onSave} disabled={saving}
      style={{ width: '100%', height: 50, borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontFamily: 'inherit', fontSize: 15, fontWeight: 800, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1 }}>
      {saving ? '저장 중…' : mode === 'edit' ? '변경 저장' : '굿즈자랑 등록'}
    </button>
  )

  return (
    <SettingsSubShell title={mode === 'create' ? '굿즈자랑' : '굿즈 편집'} onBack={() => router.back()} right={registerBtn}>
      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>불러오는 중...</div>
      ) : mode === 'create' ? (
        /* ── 굿즈자랑 전용 깔끔 화면 ── */
        <div style={{ paddingBottom: 40 }}>
          <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, margin: '0 0 18px', whiteSpace: 'pre-line' }}>
            내가 소장한 굿즈를 자랑해보세요.{'\n'}커뮤니티 굿즈자랑에 올라가고 내 굿즈·컬렉션에도 담겨요.
          </p>

          <div style={{ marginBottom: fieldGap }}>{photoGrid(false)}</div>

          <textarea value={shareContent} onChange={e => setShareContent(e.target.value)} maxLength={2000} rows={3}
            placeholder="이 굿즈에 대해 자랑해보세요 (선택)"
            style={{ width: '100%', border: 'none', outline: 'none', resize: 'vertical', background: 'transparent', color: 'var(--text)', fontSize: 15, fontFamily: 'inherit', lineHeight: 1.6, padding: '0 2px', marginBottom: fieldGap }} />

          <div style={{ marginBottom: fieldGap }}>{tagField}</div>

          <div style={{ marginBottom: fieldGap }}>{workRow}</div>

          {err && <div style={{ color: 'var(--red, #e5484d)', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{err}</div>}
          {primaryBtn}
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10, textAlign: 'center' }}>업로드 시 위치정보 등 EXIF는 자동 제거돼요.</div>
        </div>
      ) : (
        /* ── 편집 (소장품 상세 정보) ── */
        <div style={{ paddingBottom: 40 }}>
          <div style={{ marginBottom: fieldGap }}>
            <label style={label}>사진<span style={{ color: 'var(--accent)' }}> *</span></label>
            {photoGrid(false)}
          </div>

          <div style={{ marginBottom: fieldGap }}>
            <label style={label}>컬렉션(작품)<span style={{ color: 'var(--accent)' }}> *</span></label>
            {workRow}
          </div>

          <div style={{ marginBottom: fieldGap }}>
            <label style={label}>태그<span style={optional}>선택</span></label>
            {tagField}
          </div>

          <div style={{ marginBottom: fieldGap }}>
            <label style={label}>이름<span style={optional}>선택</span></label>
            <input value={name} onChange={e => setName(e.target.value)} maxLength={100} placeholder="예: 레미 피규어 ver.2" style={inputBase} />
          </div>

          <div style={{ marginBottom: fieldGap }}>
            <button type="button" onClick={() => setShowBuyInfo(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: 'none', color: 'var(--muted)', fontFamily: 'inherit', fontSize: 13, fontWeight: 800, cursor: 'pointer', padding: 0 }}>
              구매 정보 {showBuyInfo ? '접기' : '추가'}
              <svg width="14" height="14" viewBox="0 0 24 24" {...P} style={{ transform: showBuyInfo ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}><path d="m6 9 6 6 6-6" /></svg>
            </button>
            {showBuyInfo && (
              <div style={{ marginTop: 12 }}>
                <div style={{ marginBottom: 12 }}>
                  <label style={label}>캐릭터<span style={optional}>선택</span></label>
                  <input value={character} onChange={e => setCharacter(e.target.value)} maxLength={60} placeholder="예: 하루카제 레미" style={inputBase} />
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <label style={label}>구매처<span style={optional}>선택</span></label>
                    <input value={store} onChange={e => setStore(e.target.value)} maxLength={80} placeholder="예: 애니메이트" style={inputBase} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <label style={label}>구매일<span style={optional}>선택</span></label>
                    <input type="date" value={purchasedOn} onChange={e => setPurchasedOn(e.target.value)} style={inputBase} />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={{ marginBottom: fieldGap }}>
            <label style={label}>메모<span style={optional}>선택 · 나만 보기</span></label>
            <textarea value={memo} onChange={e => setMemo(e.target.value)} maxLength={1000} rows={3} placeholder="나만 볼 메모" style={{ ...inputBase, resize: 'vertical' }} />
          </div>

          <div style={{ marginBottom: fieldGap }}>
            <label style={label}>공개 범위</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {VIS.map(v => <button key={v.key} onClick={() => setVisibility(v.key)} style={{ ...chip(visibility === v.key), flex: 1 }}>{v.label}</button>)}
            </div>
          </div>

          {err && <div style={{ color: 'var(--red, #e5484d)', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{err}</div>}
          {primaryBtn}
          <button onClick={onDelete} disabled={saving}
            style={{ width: '100%', height: 46, marginTop: 10, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--red, #e5484d)', fontFamily: 'inherit', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
            굿즈 삭제
          </button>
        </div>
      )}
    </SettingsSubShell>
  )
}

const tagChip: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 9999,
  border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 12.5, fontWeight: 700,
}
const tagX: React.CSSProperties = {
  border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', padding: 0, marginLeft: 1,
}
const rowCard: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
  padding: '15px 16px', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)',
  cursor: 'pointer', fontFamily: 'inherit',
}
function chip(on: boolean): React.CSSProperties {
  return {
    border: on ? '1px solid var(--accent)' : '1px solid var(--border)', background: on ? 'var(--accent-l)' : 'var(--surface)',
    color: on ? 'var(--accent)' : 'var(--muted)', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
    cursor: 'pointer', padding: '8px 14px', borderRadius: 9999, whiteSpace: 'nowrap',
  }
}
