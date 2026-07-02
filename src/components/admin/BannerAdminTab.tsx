'use client'
import { useState, useEffect, useRef, CSSProperties, ReactNode } from 'react'
import { getAllBanners, uploadBannerImage, FeaturedBanner } from '@/services/featuredBannerService'
import { adminUpsert } from '@/services/adminUpsertService'
import { Button } from '@/components/tds/Button'

type Draft = { title: string; subtitle: string; image_url: string; cta_label: string; cta_href: string; cta_label2: string; cta_href2: string; bg_color: string; text_color: string; sort_order: string; is_active: boolean }

const EMPTY: Draft = { title: '', subtitle: '', image_url: '', cta_label: '', cta_href: '', cta_label2: '', cta_href2: '', bg_color: '#FFEDE6', text_color: '#20202D', sort_order: '0', is_active: true }

function toDraft(b: FeaturedBanner): Draft {
  return {
    title: b.title ?? '', subtitle: b.subtitle ?? '', image_url: b.image_url ?? '',
    cta_label: b.cta_label ?? '', cta_href: b.cta_href ?? '',
    cta_label2: b.cta_label2 ?? '', cta_href2: b.cta_href2 ?? '',
    bg_color: b.bg_color ?? '#FFEDE6', text_color: b.text_color ?? '#20202D',
    sort_order: String(b.sort_order ?? 0), is_active: b.is_active ?? true,
  }
}

const inputStyle: CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', fontFamily: 'inherit', fontSize: 14, background: 'var(--surface)', color: 'var(--text)' }

export default function BannerAdminTab() {
  const [banners, setBanners] = useState<FeaturedBanner[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<'new' | FeaturedBanner | null>(null)

  async function load() { setLoading(true); setBanners(await getAllBanners()); setLoading(false) }
  useEffect(() => { load() }, [])

  async function handleToggle(b: FeaturedBanner) {
    await adminUpsert({ table: 'featured_banners', id: b.id, fields: { is_active: !b.is_active }, action: 'update' })
    load()
  }
  async function handleDelete(b: FeaturedBanner) {
    if (!confirm(`"${b.title}" 배너를 삭제할까요? 되돌릴 수 없어요.`)) return
    await adminUpsert({ table: 'featured_banners', id: b.id, action: 'delete' })
    load()
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>불러오는 중...</div>

  if (editing) {
    const nextOrder = banners.length ? Math.max(...banners.map((b) => b.sort_order ?? 0)) + 1 : 0
    return (
      <BannerEditForm
        initial={editing === 'new' ? { ...EMPTY, sort_order: String(nextOrder) } : toDraft(editing)}
        id={editing === 'new' ? undefined : editing.id}
        onDone={() => { setEditing(null); load() }}
        onCancel={() => setEditing(null)}
      />
    )
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <p style={{ fontSize: 12, color: 'var(--muted)' }}>홈 Hero 배너 · {banners.length}개 · 위→아래 = 노출 순서</p>
        <button onClick={() => setEditing('new')} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>+ 새 배너</button>
      </div>

      {banners.length === 0 ? (
        <div style={{ padding: '50px 20px', textAlign: 'center', color: 'var(--muted)' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🖼️</div>
          <p style={{ fontSize: 14 }}>아직 배너가 없어요. "새 배너"로 첫 배너를 만들어보세요.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {banners.map((b) => (
            <div key={b.id} style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', opacity: b.is_active ? 1 : 0.55 }}>
              <BannerPreview draft={toDraft(b)} compact />
              <div style={{ display: 'flex', gap: 6, padding: 8, borderTop: '1px solid var(--border)' }}>
                <span style={{ fontSize: 11, color: 'var(--muted)', alignSelf: 'center', marginRight: 'auto' }}>순서 {b.sort_order} · {b.is_active ? '노출중' : '숨김'}</span>
                <MiniBtn onClick={() => handleToggle(b)}>{b.is_active ? '숨기기' : '노출'}</MiniBtn>
                <MiniBtn onClick={() => setEditing(b)}>수정</MiniBtn>
                <MiniBtn danger onClick={() => handleDelete(b)}>삭제</MiniBtn>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function BannerEditForm({ initial, id, onDone, onCancel }: { initial: Draft; id?: string; onDone: () => void; onCancel: () => void }) {
  const [d, setD] = useState<Draft>(initial)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function set<K extends keyof Draft>(k: K, v: Draft[K]) { setD((p) => ({ ...p, [k]: v })); setErr(null) }

  async function handleUpload(file: File) {
    setUploading(true); setErr(null)
    const url = await uploadBannerImage(file)
    setUploading(false)
    if (!url) { setErr('업로드 실패 (URL 직접 붙여넣기는 항상 됩니다)'); return }
    set('image_url', url)
  }

  async function handleSave() {
    if (!d.title.trim()) { setErr('제목은 필수예요'); return }
    const order = d.sort_order.trim() === '' ? 0 : parseInt(d.sort_order, 10)
    if (Number.isNaN(order)) { setErr('노출 순서는 숫자만'); return }
    setSaving(true); setErr(null)
    const fields = {
      title: d.title.trim(), subtitle: d.subtitle.trim() || null, image_url: d.image_url.trim() || null,
      cta_label: d.cta_label.trim() || null, cta_href: d.cta_href.trim() || null,
      cta_label2: d.cta_label2.trim() || null, cta_href2: d.cta_href2.trim() || null,
      bg_color: d.bg_color, text_color: d.text_color, sort_order: order, is_active: d.is_active,
    }
    const res = await adminUpsert({ table: 'featured_banners', id, fields, action: id ? 'update' : 'insert' })
    setSaving(false)
    if (!res.ok) { setErr(res.error ?? '저장 실패'); return }
    onDone()
  }

  return (
    <div style={{ padding: 16 }}>
      <button onClick={onCancel} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, padding: 0, marginBottom: 16 }}>← 목록</button>

      <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)', marginBottom: 8 }}>
        <BannerPreview draft={d} />
      </div>
      <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 18 }}>※ 이미지를 넣으면 배너 전체 배경이 됩니다. 이미지 배너는 글자색을 흰색(#FFFFFF) 계열로 추천. 버튼은 최대 2개, 1개만 넣으면 크게 표시돼요.</p>

      <Field label="제목 (필수)"><input value={d.title} onChange={(e) => set('title', e.target.value)} style={inputStyle} /></Field>
      <Field label="문구 (subtitle)"><input value={d.subtitle} onChange={(e) => set('subtitle', e.target.value)} style={inputStyle} /></Field>

      <Field label="이미지 (넣으면 배너 전체 배경)">
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={d.image_url} placeholder="이미지 URL" onChange={(e) => set('image_url', e.target.value)} style={{ ...inputStyle, flex: 1 }} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ flexShrink: 0, padding: '0 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontWeight: 700, fontSize: 13, cursor: uploading ? 'wait' : 'pointer', fontFamily: 'inherit' }}>{uploading ? '업로드 중' : '파일'}</button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = '' }} />
      </Field>

      <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '12px 12px 2px', marginBottom: 14 }}>
        <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)', marginBottom: 10 }}>버튼 1 (핑크, 메인)</p>
        <Field label="문구"><input value={d.cta_label} onChange={(e) => set('cta_label', e.target.value)} style={inputStyle} placeholder="예: 지도 탐험하기" /></Field>
        <Field label="링크"><input value={d.cta_href} onChange={(e) => set('cta_href', e.target.value)} style={inputStyle} placeholder="예: /map" /></Field>
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '12px 12px 2px', marginBottom: 14 }}>
        <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', marginBottom: 10 }}>버튼 2 (흰색, 선택 — 비우면 버튼 1개가 크게)</p>
        <Field label="문구"><input value={d.cta_label2} onChange={(e) => set('cta_label2', e.target.value)} style={inputStyle} placeholder="예: 인기 샵 보기" /></Field>
        <Field label="링크"><input value={d.cta_href2} onChange={(e) => set('cta_href2', e.target.value)} style={inputStyle} placeholder="예: /shops" /></Field>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <Field label="배경색 (이미지 없을 때)"><ColorInput value={d.bg_color} onChange={(v) => set('bg_color', v)} /></Field>
        <Field label="글자색"><ColorInput value={d.text_color} onChange={(v) => set('text_color', v)} /></Field>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
        <Field label="노출 순서 (작을수록 앞)"><input value={d.sort_order} onChange={(e) => set('sort_order', e.target.value)} style={inputStyle} inputMode="numeric" /></Field>
        <Field label="활성 여부">
          <button onClick={() => set('is_active', !d.is_active)} style={{ ...inputStyle, cursor: 'pointer', textAlign: 'left', fontWeight: 700, color: d.is_active ? 'var(--green)' : 'var(--muted)' }}>{d.is_active ? '● 노출중' : '○ 숨김'}</button>
        </Field>
      </div>

      {err && <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--red)', marginBottom: 12 }}>{err}</p>}

      <Button variant="primary" fullWidth disabled={saving} onClick={handleSave}>{saving ? '저장 중...' : (id ? '수정 저장' : '배너 만들기')}</Button>
    </div>
  )
}

function BannerPreview({ draft, compact }: { draft: Draft; compact?: boolean }) {
  const h = compact ? 110 : 220
  const buttons = [{ label: draft.cta_label }, { label: draft.cta_label2 }].filter((b) => !!(b.label && b.label.trim()))
  const solo = buttons.length === 1
  return (
    <div style={{ position: 'relative', overflow: 'hidden', background: draft.bg_color, color: draft.text_color, minHeight: h, display: 'flex', alignItems: 'center' }}>
      {draft.image_url && (
        <>
          <img src={draft.image_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(0,0,0,.55), rgba(0,0,0,.2) 55%, rgba(0,0,0,0) 85%)' }} />
        </>
      )}
      <div style={{ position: 'relative', zIndex: 1, flex: 1, padding: compact ? '14px 16px' : '22px 26px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 }}>
        <div style={{ fontSize: compact ? 17 : 26, fontWeight: 900, color: draft.text_color, lineHeight: 1.28 }}>{draft.title || '제목'}</div>
        {draft.subtitle && <div style={{ fontSize: compact ? 12 : 15, color: draft.text_color, opacity: 0.9 }}>{draft.subtitle}</div>}
        {buttons.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginTop: compact ? 8 : 14, flexWrap: 'wrap' }}>
            {buttons.map((b, i) => {
              const big = solo
              const primary = i === 0
              return (
                <span key={i} style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  padding: big ? (compact ? '9px 20px' : '13px 30px') : (compact ? '7px 14px' : '11px 22px'),
                  fontSize: big ? (compact ? 13 : 16) : (compact ? 12 : 15), fontWeight: 800, borderRadius: 12,
                  background: primary ? 'var(--accent)' : '#fff',
                  color: primary ? '#fff' : 'var(--text)',
                  border: primary ? 'none' : '1px solid rgba(0,0,0,.08)',
                }}>{b.label}</span>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function MiniBtn({ children, onClick, danger }: { children: ReactNode; onClick: () => void; danger?: boolean }) {
  return <button onClick={onClick} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: danger ? 'var(--red)' : 'var(--text)', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>{children}</button>
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 14, flex: 1 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  )
}

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} style={{ width: 40, height: 40, border: '1px solid var(--border)', borderRadius: 8, padding: 2, cursor: 'pointer', background: 'var(--surface)' }} />
      <input value={value} onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
    </div>
  )
}

