'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { CATEGORIES } from '@/lib/constants/categories'
import { ROUTES } from '@/lib/constants/routes'
import { createShop, updateShop } from '@/services/shopService'
import { Shop, ShopFormData } from '@/types/shop'
import { generateSlug } from '@/lib/utils/shop'

interface Props {
  mode: 'create' | 'edit'
  shop?: Shop
}

const EMPTY_FORM: ShopFormData = {
  name: '', slug: '', description: '', addr: '',
  lat: null, lng: null, cats: [],
  hours: null, parking: null, parking_note: '',
  shop_link: '', start_date: '', end_date: '', event_info: '',
}

export default function ShopForm({ mode, shop }: Props) {
  const router = useRouter()
  const { user } = useAuth()
  const [form, setForm] = useState<ShopFormData>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) router.push(ROUTES.login)
  }, [user, router])

  useEffect(() => {
    if (mode === 'edit' && shop) {
      setForm({
        name: shop.name,
        slug: shop.slug,
        description: shop.description ?? '',
        addr: shop.addr ?? '',
        lat: shop.lat,
        lng: shop.lng,
        cats: shop.cats,
        hours: shop.hours,
        parking: shop.parking,
        parking_note: shop.parking_note ?? '',
        shop_link: shop.shop_link ?? '',
        start_date: shop.start_date ?? '',
        end_date: shop.end_date ?? '',
        event_info: shop.event_info ?? '',
      })
    }
  }, [mode, shop])

  function set(key: keyof ShopFormData, value: any) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function toggleCat(cat: string) {
    setForm(prev => ({
      ...prev,
      cats: prev.cats.includes(cat)
        ? prev.cats.filter(c => c !== cat)
        : [...prev.cats, cat],
    }))
  }

  function handleNameChange(name: string) {
    set('name', name)
    if (mode === 'create') {
      set('slug', generateSlug(name))
    }
  }

  async function handleSubmit() {
    if (!user) return
    if (!form.name.trim()) return setError('샵 이름을 입력해주세요')
    if (!form.slug.trim()) return setError('슬러그를 입력해주세요')
    if (form.cats.length === 0) return setError('카테고리를 하나 이상 선택해주세요')

    setSubmitting(true)
    setError('')

    if (mode === 'create') {
      const result = await createShop(form, user.id)
      if (!result) {
        setError('등록에 실패했어요. 슬러그가 중복되었을 수 있어요.')
        setSubmitting(false)
        return
      }
      router.push(ROUTES.shop(result.slug))
    } else if (shop) {
      const ok = await updateShop(shop.id, form, user.id)
      if (!ok) {
        setError('수정에 실패했어요.')
        setSubmitting(false)
        return
      }
      router.push(ROUTES.shop(shop.slug))
    }
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '0 0 80px' }}>
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px',
      }}>
        <button onClick={() => router.back()} style={{
          background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer',
        }}>←</button>
        <h1 style={{ fontSize: '16px', fontWeight: 900 }}>
          {mode === 'create' ? '샵 등록' : '샵 수정'}
        </h1>
      </div>

      <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        <Field label="샵 이름 *">
          <input
            type="text"
            value={form.name}
            onChange={e => handleNameChange(e.target.value)}
            placeholder="예: 애니메이트 홍대"
            style={inputStyle}
          />
        </Field>

        <Field label="슬러그 *" hint="URL에 사용되는 영문 주소예요 (예: animate-hongdae)">
          <input
            type="text"
            value={form.slug}
            onChange={e => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            placeholder="animate-hongdae"
            style={inputStyle}
          />
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
            → /shop/{form.slug || '...'}
          </div>
        </Field>

        <Field label="카테고리 *">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {CATEGORIES.map(cat => {
              const selected = form.cats.includes(cat.name)
              return (
                <button
                  key={cat.slug}
                  onClick={() => toggleCat(cat.name)}
                  style={{
                    padding: '6px 12px', borderRadius: '20px', cursor: 'pointer',
                    border: `1.5px solid ${selected ? cat.color : 'var(--border)'}`,
                    background: selected ? cat.color : 'var(--surface)',
                    color: selected ? '#fff' : 'var(--text)',
                    fontSize: '13px', fontWeight: 700, fontFamily: 'inherit',
                  }}
                >
                  {cat.icon} {cat.name}
                </button>
              )
            })}
          </div>
        </Field>

        <Field label="주소">
          <input
            type="text"
            value={form.addr}
            onChange={e => set('addr', e.target.value)}
            placeholder="예: 서울 마포구 와우산로 21"
            style={inputStyle}
          />
        </Field>

        <Field label="소개">
          <textarea
            value={form.description}
            onChange={e => set('description', e.target.value)}
            placeholder="샵에 대한 간단한 소개를 입력해주세요"
            rows={4}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </Field>

        <Field label="공식 링크">
          <input
            type="url"
            value={form.shop_link}
            onChange={e => set('shop_link', e.target.value)}
            placeholder="https://..."
            style={inputStyle}
          />
        </Field>

        <Field label="주차">
          <div style={{ display: 'flex', gap: '8px' }}>
            {[
              { label: '모름', value: null },
              { label: '가능', value: true },
              { label: '불가', value: false },
            ].map(opt => (
              <button
                key={String(opt.value)}
                onClick={() => set('parking', opt.value)}
                style={{
                  padding: '8px 16px', borderRadius: '8px', cursor: 'pointer',
                  border: `1.5px solid ${form.parking === opt.value ? 'var(--accent)' : 'var(--border)'}`,
                  background: form.parking === opt.value ? 'var(--accent-l)' : 'var(--surface)',
                  color: form.parking === opt.value ? 'var(--accent)' : 'var(--text)',
                  fontWeight: 700, fontSize: '13px', fontFamily: 'inherit',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {form.parking !== null && (
            <input
              type="text"
              value={form.parking_note}
              onChange={e => set('parking_note', e.target.value)}
              placeholder="주차 관련 메모 (예: 건물 내 2시간 무료)"
              style={{ ...inputStyle, marginTop: '8px' }}
            />
          )}
        </Field>

        <Field label="팝업 기간" hint="팝업스토어인 경우에만 입력해주세요">
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="date"
              value={form.start_date}
              onChange={e => set('start_date', e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            />
            <span style={{ color: 'var(--muted)' }}>~</span>
            <input
              type="date"
              value={form.end_date}
              onChange={e => set('end_date', e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            />
          </div>
        </Field>

        {(form.start_date || form.end_date) && (
          <Field label="팝업 이벤트 내용">
            <textarea
              value={form.event_info}
              onChange={e => set('event_info', e.target.value)}
              placeholder="이벤트 내용을 입력해주세요"
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </Field>
        )}

        {error && (
          <div style={{
            padding: '12px', borderRadius: '8px',
            background: 'var(--red-l)', color: 'var(--red)',
            fontSize: '13px', fontWeight: 700,
          }}>
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            width: '100%', padding: '14px', borderRadius: '12px',
            background: submitting ? 'var(--border)' : 'var(--accent)',
            color: '#fff', border: 'none',
            fontWeight: 900, fontSize: '16px',
            cursor: submitting ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {submitting ? '처리 중...' : mode === 'create' ? '등록 신청' : '수정 완료'}
        </button>

        {mode === 'create' && (
          <p style={{ fontSize: '12px', color: 'var(--muted)', textAlign: 'center', marginTop: '-12px' }}>
            등록 후 관리자 승인 후 지도에 표시돼요.
          </p>
        )}
      </div>
    </div>
  )
}

function Field({ label, hint, children }: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label style={{ fontSize: '13px', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
        {label}
      </label>
      {hint && (
        <p style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '6px' }}>{hint}</p>
      )}
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 12px',
  border: '1.5px solid var(--border)', borderRadius: '10px',
  fontSize: '14px', fontFamily: 'inherit',
  background: 'var(--surface2)', color: 'var(--text)',
  outline: 'none', boxSizing: 'border-box',
}
