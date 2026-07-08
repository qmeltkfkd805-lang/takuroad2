'use client'

import { useState, useEffect, useMemo } from 'react'
import { Shop } from '@/types/shop'
import { getShops } from '@/services/shopService'
import { shopRegion, shopDistrict, sortRegions } from '@/lib/utils/region'

export function useShops() {
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCat, setSelectedCat] = useState<string>('전체')
  const [selectedRegion, setSelectedRegion] = useState<string>('전체')
  const [selectedDistrict, setSelectedDistrict] = useState<string>('전체')
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null)

  useEffect(() => {
    getShops().then(data => {
      setShops(data)
      setLoading(false)
    })
  }, [])

  // 카테고리 + 지역(시/도 → 구/군) 필터. 지역은 DB 값 없으면 주소에서 추출
  const filtered = useMemo(() => {
    return shops.filter(shop => {
      const catMatch = selectedCat === '전체' || shop.cats.includes(selectedCat)
      const regionMatch = selectedRegion === '전체' || shopRegion(shop) === selectedRegion
      const districtMatch = selectedDistrict === '전체' || shopDistrict(shop) === selectedDistrict
      return catMatch && regionMatch && districtMatch
    })
  }, [shops, selectedCat, selectedRegion, selectedDistrict])

  // 지도에 표시할 샵 (온라인샵 제외)
  const mapShops = useMemo(() => {
    return filtered.filter(s => s.lat && s.lng && !s.cats.includes('온라인샵'))
  }, [filtered])

  // 시/도 목록 — 온라인샵 제외, 실제 샵이 있는 곳만
  const regions = useMemo(() => {
    const set = new Set<string>()
    for (const s of shops) {
      if (s.cats.includes('온라인샵')) continue
      const r = shopRegion(s)
      if (r) set.add(r)
    }
    return ['전체', ...sortRegions(Array.from(set))]
  }, [shops])

  // 시/도별 구·군 목록 { 서울: ['강남구', '마포구', …] }
  const districtsByRegion = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const s of shops) {
      if (s.cats.includes('온라인샵')) continue
      const r = shopRegion(s)
      const d = shopDistrict(s)
      if (!r || !d) continue
      if (!map.has(r)) map.set(r, new Set())
      map.get(r)!.add(d)
    }
    const out: Record<string, string[]> = {}
    for (const [r, set] of map) {
      out[r] = Array.from(set).sort((a, b) => a.localeCompare(b, 'ko'))
    }
    return out
  }, [shops])

  return {
    shops,
    filtered,
    mapShops,
    regions,
    districtsByRegion,
    loading,
    selectedCat,
    setSelectedCat,
    selectedRegion,
    setSelectedRegion,
    selectedDistrict,
    setSelectedDistrict,
    selectedShop,
    setSelectedShop,
  }
}
