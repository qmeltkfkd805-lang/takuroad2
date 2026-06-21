'use client'

import { useState, useEffect } from 'react'
import { getShopHistory, REASON_LABEL, ChangeReason } from '@/services/shopChangeLogService'

interface Props {
  shopId: string
}

const FIELD_LABEL: Record<string, string> = {
  name: '샵 이름', description: '소개', addr: '주소',
  hours: '영업시간', parking: '주차', parking_note: '주차 안내',
  shop_link: '공식 링크', status: '운영 상태', availability: '재고 상태',
}

const SOURCE_LABEL: Record<string, string> = {
  owner: '사장님', admin: '운영자', user_suggestion: '사용자 제보',
}

const TABLE_FILTERS = [
  { value: '', label: '전체' },
  { value: 'shops', label: '기본정보' },
  { value: 'shop_products', label: '굿즈' },
  { value: 'shop_events', label: '이벤트' },
  { value: 'shop_images', label: '사진' },
]

export default function ShopHistoryPanel({ shopId }: Props) {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    getShopHistory(shopId, filter || undefined).then(data => {
      setLogs(data)
      setLoading(false)
    })
  }, [shopId, filter])

  function formatValue(val: any): string {
    if (val === null || val === undefined) return '(없음)'
    if (typeof val === 'object') return JSON.stringify(val)
    if (typeof val === 'boolean') return val ? '가능' : '불가'
    return String(val)
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', marginBottom: '14px', paddingBottom: '2px' }}>
        {TABLE_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            style={{
              padding: '6px 12px', borderRadius: '16px', whiteSpace: 'nowrap',
              border: `1.5px solid ${filter === f.value ? 'var(--accent)' : 'var(--border)'}`,
              background: filter === f.value ? 'var(--accent-l)' : 'var(--surface)',
              color: filter === f.value ? 'var(--accent)' : 'var(--text)',
              fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '13px', padding: '30px 0' }}>불러오는 중...</p>
      ) : logs.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '13px', padding: '30px 0' }}>변경 이력이 없어요</p>
      ) : (
        logs.map(log => (
          <div key={log.id} style={{
            padding: '12px 0', borderBottom: '1px solid var(--border)',
            opacity: log.is_rolled_back ? 0.5 : 1,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontWeight: 700, fontSize: '13px' }}>
                {FIELD_LABEL[log.field_name] ?? log.field_name} 변경
                {log.is_rolled_back && ' (되돌려짐)'}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                {new Date(log.created_at).toLocaleDateString('ko-KR')}
              </span>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text)', marginBottom: '4px' }}>
              {formatValue(log.old_value)} → <strong>{formatValue(log.new_value)}</strong>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
              {SOURCE_LABEL[log.change_source] ?? log.change_source}
              {log.profiles?.nickname && ` (${log.profiles.nickname})`}
              {log.reason && ` · ${REASON_LABEL[log.reason as ChangeReason] ?? log.reason}`}
            </div>
          </div>
        ))
      )}
    </div>
  )
}