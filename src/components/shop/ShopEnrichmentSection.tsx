'use client'

import { useState, useEffect } from 'react'
import { getAllTags } from '@/services/shopService'
import {
  getShopTags, updateShopTags, getShopProductsBySeries,
  upsertShopProduct, getAllGoodsTypes, Availability, AVAILABILITY_LABEL,
} from '@/services/shopProductService'
import { useAuth } from '@/components/layout/AuthProvider'

interface Props {
  shopId: string
}

const AVAILABILITY_ORDER: Availability[] = ['unknown', 'not_sold', 'sold_out', 'few', 'normal', 'many']

export default function ShopEnrichmentSection({ shopId }: Props) {
  const { user } = useAuth()
  const [allTags, setAllTags] = useState<any[]>([])
  const [myTags, setMyTags] = useState<any[]>([])
  const [allGoodsTypes, setAllGoodsTypes] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [savingTags, setSavingTags] = useState(false)

  useEffect(() => {
    loadAll()
  }, [shopId])

  async function loadAll() {
    const [tags, shopTags, goodsTypes, productsBySeries] = await Promise.all([
      getAllTags(),
      getShopTags(shopId),
      getAllGoodsTypes(),
      getShopProductsBySeries(shopId),
    ])
    setAllTags(tags)
    setMyTags(shopTags)
    setAllGoodsTypes(goodsTypes)
    setProducts(productsBySeries)
    setLoading(false)
  }

  function toggleTag(tag: any) {
    setMyTags(prev =>
      prev.some(t => t.id === tag.id)
        ? prev.filter(t => t.id !== tag.id)
        : [...prev, tag]
    )
  }

  async function saveTags() {
    setSavingTags(true)
    await updateShopTags(shopId, myTags.map(t => t.id))
    await loadAll()
    setSavingTags(false)
  }

  async function cycleAvailability(tagId: string, goodsTypeId: string, current: Availability) {
    if (!user) return
    const idx = AVAILABILITY_ORDER.indexOf(current)
    const next = AVAILABILITY_ORDER[(idx + 1) % AVAILABILITY_ORDER.length]
    await upsertShopProduct({
      shopId, tagId, goodsTypeId,
      availability: next,
      source: 'owner',
      confirmedByType: 'owner',
      userId: user.id,
    })
    await loadAll()
  }

  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center', color: 'var(--muted)' }}>불러오는 중...</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* 1단계: 취급 작품 (가벼운 입력) */}
      <div>
        <h3 style={{ fontSize: '14px', fontWeight: 900, marginBottom: '6px' }}>🎮 취급 작품</h3>
        <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '10px' }}>
          이 샵에서 다루는 작품을 선택해주세요 (10초면 끝나요)
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
          {allTags.map(tag => {
            const selected = myTags.some(t => t.id === tag.id)
            return (
              <button
                key={tag.id}
                onClick={() => toggleTag(tag)}
                style={{
                  padding: '6px 12px', borderRadius: '20px', cursor: 'pointer',
                  border: `1.5px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                  background: selected ? 'var(--accent-l)' : 'var(--surface)',
                  color: selected ? 'var(--accent)' : 'var(--text)',
                  fontSize: '13px', fontWeight: 700, fontFamily: 'inherit',
                }}
              >
                {tag.name}
              </button>
            )
          })}
        </div>
        <button
          onClick={saveTags}
          disabled={savingTags}
          style={{
            padding: '9px 16px', borderRadius: '8px', border: 'none',
            background: 'var(--accent)', color: '#fff', fontWeight: 700,
            fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {savingTags ? '저장 중...' : '취급 작품 저장'}
        </button>
      </div>

      <div style={{ height: '1px', background: 'var(--border)' }} />

      {/* 2단계: 작품별 굿즈 상세 (선택, 천천히) */}
      <div>
        <h3 style={{ fontSize: '14px', fontWeight: 900, marginBottom: '6px' }}>🛍️ 작품별 취급 굿즈</h3>
        <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '6px' }}>
          선택사항이에요. 천천히 추가해도 괜찮아요.
        </p>
        <p style={{
          fontSize: '12px', color: 'var(--accent)', marginBottom: '14px',
          background: 'var(--accent-l)', borderRadius: '8px', padding: '8px 10px',
        }}>
          💡 칸을 누를 때마다 순서대로 바뀌어요<br />
          <strong>확인안됨 → 판매안함 → 품절 → 소량 → 보통 → 많음</strong>
        </p>

        {myTags.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--muted)' }}>먼저 위에서 취급 작품을 선택하고 저장해주세요</p>
        ) : (
          myTags.map(tag => {
            const series = products.find(p => p.tagId === tag.id)
            return (
              <div key={tag.id} style={{ marginBottom: '16px' }}>
                <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '8px' }}>{tag.name}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '6px' }}>
                  {allGoodsTypes.map((gt: any) => {
                    const existing = series?.goodsList.find((g: any) => g.goodsTypeId === gt.id)
                    const availability: Availability = existing?.availability ?? 'unknown'
                    const isSet = availability !== 'unknown'
                    return (
                      <button
                        key={gt.id}
                        onClick={() => cycleAvailability(tag.id, gt.id, availability)}
                        style={{
                          padding: '8px 6px', borderRadius: '8px', textAlign: 'center',
                          border: `1.5px solid ${isSet ? 'var(--accent)' : 'var(--border)'}`,
                          background: isSet ? 'var(--accent-l)' : 'var(--surface)',
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        <div style={{ fontSize: '16px' }}>{gt.icon}</div>
                        <div style={{ fontSize: '10px', fontWeight: 700, marginTop: '2px' }}>{gt.name}</div>
                        <div style={{
                          fontSize: '9px', fontWeight: 700, marginTop: '2px',
                          color: isSet ? 'var(--accent)' : 'var(--muted)',
                        }}>
                          {AVAILABILITY_LABEL[availability]}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}