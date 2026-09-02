'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import {
  EventGoods, GoodsInput, GoodsKind,
  getEventGoods, createEventGoods, updateEventGoods, hideEventGoods, uploadGoodsImage,
} from '@/services/eventGoodsService'
import { EventIcon } from './EventIcon'

const EMPTY: GoodsInput = { name: '', kind: 'goods', price: null, imageUrl: null }
const won = (n: number) => `${n.toLocaleString('ko-KR')}원`

export default function EventGoodsTab({ eventId }: { eventId: string }) {
  const { user } = useAuth()
  const router = useRouter()
  const [rows, setRows] = useState<EventGoods[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [zoom, setZoom] = useState<string | null>(null)

  const load = async () => {
    setRows(await getEventGoods(eventId))
    setLoading(false)
  }
  useEffect(() => { load()   }, [eventId])

  const hide = async (id: string) => {
    if (!user) return
    if (!confirm('이 항목을 목록에서 숨길까요? (관리자가 되돌릴 수 있어요)')) return
    if (await hideEventGoods(id, user.id)) load()
  }

  const menus = rows.filter(r => r.kind === 'menu')
  const goods = rows.filter(r => r.kind === 'goods')

  return (
    <div>
      <p style={notice}>
        이벤트에 등록된 메뉴·굿즈예요. <strong>틀린 정보가 있으면 누구나 고칠 수 있습니다.</strong>
      </p>

      {loading ? (
        <p style={muted}>불러오는 중…</p>
      ) : rows.length === 0 && editing !== 'new' ? (
        <p style={muted}>아직 등록된 메뉴·굿즈가 없어요. 다녀오셨다면 먼저 등록해주세요.</p>
      ) : (
        <>
          {menus.length > 0 && <Group title="메뉴" items={menus} editing={editing} setEditing={setEditing} onSaved={load} onHide={hide} onZoom={setZoom} eventId={eventId} userId={user?.id} />}
          {goods.length > 0 && <Group title="굿즈" items={goods} editing={editing} setEditing={setEditing} onSaved={load} onHide={hide} onZoom={setZoom} eventId={eventId} userId={user?.id} />}
        </>
      )}

      {editing === 'new' ? (
        <div style={{ marginTop: 16 }}>
          <GoodsForm
            eventId={eventId}
            userId={user?.id}
            onCancel={() => setEditing(null)}
            onSaved={() => { setEditing(null); load() }}
          />
        </div>
      ) : (
        <button
          onClick={() => (user ? setEditing('new') : router.push('/login'))}
          style={addBtn}
        >
          + 메뉴·굿즈 추가하기
        </button>
      )}

      {zoom && <Lightbox src={zoom} onClose={() => setZoom(null)} />}
    </div>
  )
}

/** 이미지 확대 — 바깥 클릭·ESC·× 로 닫힘 */
function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(16,16,24,.86)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24, cursor: 'zoom-out',
      }}
    >
      <img
        src={src}
        alt=""
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '100%', maxHeight: '100%', objectFit: 'contain',
          borderRadius: 12, cursor: 'default',
        }}
      />
      <button
        onClick={onClose}
        aria-label="닫기"
        style={{
          position: 'absolute', top: 20, right: 20,
          width: 40, height: 40, borderRadius: 9999, border: 'none',
          background: 'rgba(255,255,255,.14)', color: '#fff',
          fontSize: 20, cursor: 'pointer', lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  )
}

function Group({
  title, items, editing, setEditing, onSaved, onHide, onZoom, eventId, userId,
}: {
  title: string
  items: EventGoods[]
  editing: string | 'new' | null
  setEditing: (v: string | 'new' | null) => void
  onSaved: () => void
  onHide: (id: string) => void
  onZoom: (src: string) => void
  eventId: string
  userId?: string
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 12px' }}>{title}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
        {items.map(item => (
          editing === item.id ? (
            <div key={item.id} style={{ gridColumn: '1 / -1' }}>
              <GoodsForm
                eventId={eventId}
                userId={userId}
                initial={item}
                onCancel={() => setEditing(null)}
                onSaved={() => { setEditing(null); onSaved() }}
              />
            </div>
          ) : (
            <div key={item.id} style={card}>
              <div
                style={{ ...thumb, cursor: item.imageUrl ? 'zoom-in' : 'default' }}
                onClick={() => item.imageUrl && onZoom(item.imageUrl)}
              >
                {item.imageUrl
                  ? <img src={item.imageUrl} alt={item.name ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <EventIcon name="bag" size={26} color="var(--muted)" />}
              </div>
              <div style={{ padding: '10px 12px 12px' }}>
                {item.name && <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>{item.name}</div>}
                {item.price != null && (
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent)' }}>{won(item.price)}</div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  <button onClick={() => (userId ? setEditing(item.id) : null)} style={miniBtn}>수정</button>
                  <button onClick={() => onHide(item.id)} style={miniBtn}>숨기기</button>
                </div>
                {item.updatedBy && (
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
                    최근 수정 · {item.updatedBy.nickname}
                  </div>
                )}
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  )
}

function GoodsForm({
  eventId, userId, initial, onCancel, onSaved,
}: {
  eventId: string
  userId?: string
  initial?: EventGoods
  onCancel: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<GoodsInput>(
    initial
      ? { name: initial.name ?? '', kind: initial.kind, price: initial.price, imageUrl: initial.imageUrl }
      : EMPTY,
  )
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const pickImage = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) { setError('사진은 5MB 이하만 올릴 수 있어요.'); return }
    setUploading(true); setError(null)
    const { url, error: upErr } = await uploadGoodsImage(eventId, file)
    setUploading(false)
    if (!url) { setError(`이미지 업로드 실패: ${upErr ?? '알 수 없는 오류'}`); return }
    setForm(f => ({ ...f, imageUrl: url }))
  }

  const save = async () => {
    if (!userId) return
    const hasName = !!form.name?.trim()
    if (!hasName && !form.imageUrl) { setError('이름이나 사진 중 하나는 있어야 해요.'); return }

    setSaving(true); setError(null)
    const ok = initial
      ? await updateEventGoods(initial.id, userId, form)
      : await createEventGoods(eventId, userId, form)
    setSaving(false)
    if (!ok) { setError('저장에 실패했어요.'); return }
    onSaved()
  }

  return (
    <div style={{ background: 'var(--surface2)', borderRadius: 14, padding: 16 }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {(['goods', 'menu'] as GoodsKind[]).map(k => (
          <button
            key={k}
            onClick={() => setForm(f => ({ ...f, kind: k }))}
            style={{
              padding: '7px 14px', borderRadius: 9999, cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 12.5, fontWeight: 700,
              border: `1.5px solid ${form.kind === k ? 'var(--accent)' : 'var(--border)'}`,
              background: form.kind === k ? 'var(--accent-l)' : 'var(--surface)',
              color: form.kind === k ? 'var(--accent)' : 'var(--text)',
            }}
          >
            {k === 'goods' ? '굿즈' : '메뉴'}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <div
            onClick={() => fileRef.current?.click()}
            style={{ ...thumb, width: 96, height: 96, borderRadius: 10, cursor: 'pointer', border: '1px dashed var(--border)' }}
          >
            {form.imageUrl
              ? <img src={form.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{uploading ? '올리는 중…' : '사진'}</span>}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) pickImage(f) }}
          />
          {form.imageUrl && (
            <button onClick={() => setForm(f => ({ ...f, imageUrl: null }))} style={{ ...miniBtn, marginTop: 6 }}>사진 지우기</button>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            value={form.name ?? ''}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="이름 (선택 — 사진만 올려도 돼요)"
            maxLength={80}
            style={input}
          />
          <input
            value={form.price ?? ''}
            onChange={e => {
              const v = e.target.value.replace(/[^0-9]/g, '')
              setForm(f => ({ ...f, price: v === '' ? null : Number(v) }))
            }}
            placeholder="가격 (선택, 숫자만)"
            inputMode="numeric"
            style={input}
          />
        </div>
      </div>

      {error && <div style={{ fontSize: 12.5, color: '#FF6B6B', marginTop: 10 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
        <button onClick={onCancel} style={miniBtn}>취소</button>
        <button
          onClick={save}
          disabled={saving || uploading}
          style={{
            padding: '9px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 13, fontWeight: 800,
            background: 'var(--accent)', color: '#fff', opacity: saving || uploading ? .5 : 1,
          }}
        >
          {saving ? '저장 중…' : initial ? '수정' : '등록'}
        </button>
      </div>
    </div>
  )
}

const notice: React.CSSProperties = { fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, margin: '0 0 18px' }
const muted: React.CSSProperties = { fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, margin: 0 }
const card: React.CSSProperties = {
  border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'var(--surface)',
}
const thumb: React.CSSProperties = {
  width: '100%', aspectRatio: '1 / 1', background: 'var(--surface2)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
}
const miniBtn: React.CSSProperties = {
  border: 'none', background: 'none', padding: 0, cursor: 'pointer',
  fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: 'var(--muted)',
}
const input: React.CSSProperties = {
  border: '1px solid var(--border)', borderRadius: 10, padding: '11px 12px',
  fontSize: 13.5, fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--text)',
}
const addBtn: React.CSSProperties = {
  width: '100%', marginTop: 8, padding: 14, borderRadius: 12,
  border: '1px dashed var(--border)', background: 'var(--surface)',
  cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: 'var(--accent)',
}
