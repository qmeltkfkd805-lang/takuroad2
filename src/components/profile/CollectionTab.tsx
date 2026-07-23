'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getRegionCollections, getUnvisitedShopsForRegion, getOfficialLists, getMyProgress } from '@/services/pilgrimageService'
import { LoadingState } from './SavedShopsTab'
import TagCollectionSection from './TagCollectionSection'
import AppIcon from '@/components/tds/AppIcon'

export default function CollectionTab({ userId }: { userId: string }) {
  const [regions, setRegions] = useState<any[]>([])
  const [officialProgress, setOfficialProgress] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)
  const [unvisitedShops, setUnvisitedShops] = useState<any[]>([])

  useEffect(() => {
    Promise.all([
      getRegionCollections(userId),
      getOfficialLists(),
    ]).then(async ([regionData, lists]) => {
      setRegions(regionData)

      const progressList = await Promise.all(
        lists.map(async (list: any) => ({
          ...list,
          progress: await getMyProgress(userId, list.id),
        }))
      )
      setOfficialProgress(progressList)
      setLoading(false)
    })
  }, [userId])

  async function handleRegionClick(region: string) {
    const shops = await getUnvisitedShopsForRegion(userId, region)
    setUnvisitedShops(shops)
    setSelectedRegion(region)
  }

  if (loading) return <LoadingState />

  return (
    <div style={{ padding: '16px' }}>

      {/* 공식 성지 100 진행률 */}
      {officialProgress.map(list => (
        <div key={list.id} style={{
          border: '1.5px solid var(--accent)', borderRadius: '14px',
          padding: '16px', marginBottom: '20px', background: 'var(--accent-l)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <AppIcon name="map" size={16} color="var(--accent)" />
            <span style={{ fontWeight: 900, fontSize: '15px' }}>{list.title}</span>
          </div>
          <div style={{
            height: '10px', background: 'var(--surface2)', borderRadius: '5px',
            overflow: 'hidden', marginBottom: '8px',
          }}>
            <div style={{
              height: '100%', width: `${list.progress.percent}%`,
              background: 'var(--accent)', borderRadius: '5px', transition: 'width .3s',
            }} />
          </div>
          <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
            {list.progress.visited} / {list.progress.total} 방문 ({list.progress.percent}%)
          </div>
        </div>
      ))}
<TagCollectionSection userId={userId} />

      {/* 지역별 컬렉션 */}
      <h3 style={{ fontSize: '14px', fontWeight: 900, marginBottom: '12px' }}><AppIcon name="pin" size={15} color="var(--accent)" style={{ marginRight: 6 }} />지역 컬렉션</h3>

      {regions.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '13px', padding: '40px 0' }}>
          아직 방문 기록이 없어요
        </p>
      ) : (
        regions.map(region => (
          <div
            key={region.region}
            onClick={() => handleRegionClick(region.region)}
            style={{
              padding: '14px', borderRadius: '12px', marginBottom: '10px',
              border: `1.5px solid ${region.isComplete ? 'var(--green)' : 'var(--border)'}`,
              background: region.isComplete ? 'var(--surface2)' : 'var(--surface)',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontWeight: 700, fontSize: '14px' }}>
                {region.region} {region.isComplete && <AppIcon name="sparkle" size={13} color="var(--accent)" />}
              </span>
              <span style={{ fontSize: '13px', color: region.isComplete ? 'var(--green)' : 'var(--muted)', fontWeight: 700 }}>
                {region.isComplete ? 'COMPLETE' : `${region.visited} / ${region.total}`}
              </span>
            </div>
            <div style={{
              height: '8px', background: 'var(--surface2)', borderRadius: '4px', overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', width: `${region.percent}%`,
                background: region.isComplete ? 'var(--green)' : 'var(--accent)',
                borderRadius: '4px', transition: 'width .3s',
              }} />
            </div>
          </div>
        ))
      )}

      {/* 미방문 샵 바텀시트 */}
      {selectedRegion && (
        <div
          onClick={() => setSelectedRegion(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 999,
            background: 'rgba(0,0,0,.5)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--surface)', borderRadius: '20px 20px 0 0',
              width: '100%', maxWidth: '680px', maxHeight: '70vh', overflowY: 'auto',
              padding: '20px',
            }}
          >
            <h3 style={{ fontSize: '15px', fontWeight: 900, marginBottom: '12px' }}>
              {selectedRegion} - 아직 안 가본 샵 ({unvisitedShops.length}곳)
            </h3>
            {unvisitedShops.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--green)', fontWeight: 700, padding: '20px 0' }}>
                <AppIcon name="sparkle" size={14} style={{ marginRight: 5 }} />모두 방문했어요!
              </p>
            ) : (
              unvisitedShops.map(shop => (
                <Link
                  key={shop.id}
                  href={`/shop/${shop.slug}`}
                  style={{
                    display: 'block', padding: '10px 0', borderBottom: '1px solid var(--border)',
                    textDecoration: 'none', color: 'inherit',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '14px' }}>{shop.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{shop.addr}</div>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}