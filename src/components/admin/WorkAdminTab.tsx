'use client'
import { useState, useEffect, useMemo, useRef, CSSProperties, ReactNode, RefObject } from 'react'
import Link from 'next/link'
import { getAllTagsFull, uploadWorkImage, AdminTag } from '@/services/workAdminService'
import { adminUpsert } from '@/services/adminUpsertService'
import WorkHubPanel from './WorkHubPanel'
import { Button } from '@/components/tds/Button'

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

export default function WorkAdminTab() {
  const [tags, setTags] = useState<AdminTag[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<AdminTag | null>(null)

  useEffect(() => { getAllTagsFull().then((data) => { setTags(data); setLoading(false) }) }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return tags
    return tags.filter((t) => t.name.toLowerCase().includes(q) || (t.english_name ?? '').toLowerCase().includes(q) || t.slug.toLowerCase().includes(q))
  }, [tags, query])

  function onSaved(updated: AdminTag) {
    setTags((prev) => prev.some((t) => t.id === updated.id) ? prev.map((t) => (t.id === updated.id ? updated : t)) : [updated, ...prev])
    setSelected(updated)
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>불러오는 중...</div>
  if (selected) return <WorkEditForm tag={selected} onBack={() => setSelected(null)} onSaved={onSaved} />

  return (
    <div style={{ padding: 16 }}>
      <button onClick={() => setSelected(BLANK_TAG)} style={{ width: '100%', padding: '11px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 10 }}>+ 새 작품 추가</button>
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="작품 이름 / 영문명 / slug 검색"
        style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid var(--border)', fontFamily: 'inherit', fontSize: 14, marginBottom: 14, background: 'var(--surface)', color: 'var(--text)' }} />
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>전체 {tags.length}개 · 표시 {filtered.length}개 · 숫자는 채워진 메타데이터 (최대 7)</p>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {filtered.map((t) => {
          const c = completeness(t)
          const color = c >= 6 ? 'var(--green)' : c >= 3 ? 'var(--secondary)' : 'var(--red)'
          return (
            <button key={t.id} onClick={() => setSelected(t)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 4px', borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderBottom: '1px solid var(--border)', background: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', width: '100%' }}>
              <span style={{ minWidth: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{t.name}</span>
                <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 8 }}>/{t.slug}</span>
              </span>
              <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 800, color, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 9999, background: color }} />{c}/7
              </span>
            </button>
          )
        })}
      </div>
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



