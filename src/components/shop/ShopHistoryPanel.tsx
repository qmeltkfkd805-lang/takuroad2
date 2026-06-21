'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/layout/AuthProvider'
import { getShopHistory, rollbackChange, REASON_LABEL, ChangeReason } from '@/services/shopChangeLogService'

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
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [rollingBack, setRollingBack] = useState<string | null>(null)
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadHistory()
  }, [shopId, filter])

  async function loadHistory() {
    const data = await getShopHistory(shopId, filter || undefined)
    setLogs(data)
    setLoading(false)
  }

  async function handleRollback(logId: string) {
    if (!profile) return
    if (!confirm('이 변경을 이전 상태로 되돌릴까요?')) return
    setRollingBack(logId)
    const { data: { user } } = await (await import('@/lib/supabase/client')).createClient().auth.getUser()
    if (user) {
      const ok = await rollbackChange(logId, user.id)
      if (ok) {
        window.location.reload()
        return
      }
    }
    setRollingBack(null)
  }

  function formatValue(val: any): string {
    if (val === null || val === undefined) return '(없음)'
    if (typeof val === 'object') return JSON.stringify(val)
    if (typeof val === 'boolean') return val ? '가능' : '불가'
    return String(val)
  }

  function toggleExpand(key: string) {
    setExpandedKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // target_table + target_id + field_name 기준으로 그룹핑, 그룹 안에서는 최신순
  const groups = new Map<string, any[]>()
  for (const log of logs) {
    const key = `${log.target_table}:${log.target_id ?? 'shop'}:${log.field_name}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(log)
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
      ) : groups.size === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '13px', padding: '30px 0' }}>변경 이력이 없어요</p>
      ) : (
        Array.from(groups.entries()).map(([key, groupLogs]) => {
          const latest = groupLogs[0]
          const olderLogs = groupLogs.slice(1)
          const isExpanded = expandedKeys.has(key)

          return (
            <div key={key} style={{ borderBottom: '1px solid var(--border)' }}>
              <LogItem
                log={latest}
                isAdmin={isAdmin}
                rollingBack={rollingBack}
                onRollback={handleRollback}
                formatValue={formatValue}
              />
              {olderLogs.length > 0 && (
                <button
                  onClick={() => toggleExpand(key)}
                  style={{
                    background: 'none', border: 'none', fontSize: '11px',
                    color: 'var(--accent)', cursor: 'pointer', fontFamily: 'inherit',
                    padding: '0 0 10px',
                  }}
                >
                  {isExpanded ? '이전 변경 내역 숨기기' : `이전 변경 내역 ${olderLogs.length}건 더보기`}
                </button>
              )}
              {isExpanded && olderLogs.map(log => (
                <LogItem
                  key={log.id}
                  log={log}
                  isAdmin={isAdmin}
                  rollingBack={rollingBack}
                  onRollback={handleRollback}
                  formatValue={formatValue}
                  dimmed
                />
              ))}
            </div>
          )
        })
      )}
    </div>
  )
}

function LogItem({ log, isAdmin, rollingBack, onRollback, formatValue, dimmed }: {
  log: any
  isAdmin: boolean
  rollingBack: string | null
  onRollback: (id: string) => void
  formatValue: (v: any) => string
  dimmed?: boolean
}) {
  return (
    <div style={{
      padding: '12px 0', opacity: log.is_rolled_back ? 0.5 : dimmed ? 0.7 : 1,
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
          {SOURCE_LABEL[log.change_source] ?? log.change_source}
          {log.profiles?.nickname && ` (${log.profiles.nickname})`}
          {log.reason && ` · ${REASON_LABEL[log.reason as ChangeReason] ?? log.reason}`}
        </div>
        {isAdmin && !log.is_rolled_back && log.reason !== 'rollback' && (
          <button
            onClick={() => onRollback(log.id)}
            disabled={rollingBack === log.id}
            style={{
              fontSize: '11px', padding: '4px 10px', borderRadius: '6px',
              border: '1px solid var(--border)', background: 'var(--surface)',
              color: 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
            }}
          >
            {rollingBack === log.id ? '되돌리는 중...' : '↩️ 되돌리기'}
          </button>
        )}
      </div>
    </div>
  )
}