'use client'

import { useState, useEffect } from 'react'
import { getMyTagCollections } from '@/services/tagCollectionService'
import AppIcon from '@/components/tds/AppIcon'

interface Props {
  userId: string
}

export default function TagCollectionSection({ userId }: Props) {
  const [collections, setCollections] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    getMyTagCollections(userId).then(data => {
      setCollections(data)
      setLoading(false)
    })
  }, [userId])

  if (loading) return null

  const total = collections.length
  const collectedCount = collections.filter(c => c.isCollected).length
  const percent = total > 0 ? Math.round((collectedCount / total) * 100) : 0

  const filtered = collections.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ marginBottom: '24px' }}>
      <h3 style={{ fontSize: '14px', fontWeight: 900, marginBottom: '10px' }}><AppIcon name="books" size={15} color="var(--accent)" style={{ marginRight: 6 }} />작품 컬렉션</h3>

      <div style={{
        padding: '14px', borderRadius: '12px', background: 'var(--accent-l)', marginBottom: '14px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent)' }}>수집 현황</span>
          <span style={{ fontSize: '13px', fontWeight: 900, color: 'var(--accent)' }}>
            {collectedCount} / {total}
          </span>
        </div>
        <div style={{ height: '8px', background: 'var(--surface)', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${percent}%`, background: 'var(--accent)',
            borderRadius: '4px', transition: 'width .3s',
          }} />
        </div>
      </div>

      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="작품 검색..."
        style={{
          width: '100%', padding: '9px 12px', marginBottom: '10px',
          border: '1.5px solid var(--border)', borderRadius: '8px',
          fontSize: '13px', fontFamily: 'inherit',
          background: 'var(--surface2)', color: 'var(--text)',
          outline: 'none', boxSizing: 'border-box',
        }}
      />

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '8px',
        maxHeight: '400px', overflowY: 'auto', padding: '2px',
      }}>
        {filtered.map(tag => (
          <div
            key={tag.id}
            style={{
              padding: '10px 8px', borderRadius: '10px', textAlign: 'center',
              border: `1.5px solid ${tag.isCollected ? 'var(--accent)' : 'var(--border)'}`,
              background: tag.isCollected ? 'var(--accent-l)' : 'var(--surface2)',
              opacity: tag.isCollected ? 1 : 0.5,
            }}
          >
            <div style={{ fontSize: '16px', marginBottom: '4px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: 5, border: '1.5px solid ' + (tag.isCollected ? 'var(--accent)' : 'var(--border)'), background: tag.isCollected ? 'var(--accent)' : 'transparent' }}>{tag.isCollected && <AppIcon name="check" size={12} color="#fff" />}</span>
            </div>
            <div style={{
              fontSize: '11px', fontWeight: 700,
              color: tag.isCollected ? 'var(--accent)' : 'var(--muted)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {tag.name}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}