'use client'

import { useState, useEffect, useMemo } from 'react'
import { Shop } from '@/types/shop'
import { getShops } from '@/services/shopService'
import { shopRegion, shopDistrict } from '@/lib/utils/region'

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

  // 카테고리 + 지역 필터 적용
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
    return filtered.filter(s => (s.displayLat ?? s.lat) && (s.displayLng ?? s.lng) && !s.cats.includes('온라인샵'))
  }, [filtered])

  // 지역 목록 (현재 필터 기준)
  const regions = useMemo(() => {
    const set = new Set(shops.map(s => shopRegion(s)).filter(Boolean) as string[])
    return ['전체', ...Array.from(set).sort()]
  }, [shops])

  // 지역별 구/군 목록 — CategoryFilter의 2단계 드롭다운용
  const districtsByRegion = useMemo(() => {
    const map: Record<string, Set<string>> = {}
    for (const s of shops) {
      const r = shopRegion(s)
      const d = shopDistrict(s)
      if (!r || !d) continue
      ;(map[r] ??= new Set()).add(d)
    }
    const out: Record<string, string[]> = {}
    for (const r in map) out[r] = ['전체', ...Array.from(map[r]).sort()]
    return out
  }, [shops])

  return {
    shops,
    filtered,
    mapShops,
    regions,
    loading,
    selectedCat,
    setSelectedCat,
    selectedRegion,
    setSelectedRegion,
    selectedDistrict,
    setSelectedDistrict,
    districtsByRegion,
    selectedShop,
    setSelectedShop,
  }
}
