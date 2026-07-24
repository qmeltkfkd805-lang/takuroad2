'use client'

import { useState, useEffect } from 'react'
import { getAiSummary, generateAiSummary } from '@/services/reviewService'
import AppIcon from '@/components/tds/AppIcon'

interface Props {
  shopId: string
  reviewCount: number
  accentColor: string
}

export default function AiSummaryCard({ shopId, reviewCount, accentColor }: Props) {
  const [summary, setSummary] = useState<string | null>(null)
  const [summaryReviewCount, setSummaryReviewCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getAiSummary(shopId).then(data => {
      if (data) {
        setSummary(data.summary_text)
        setSummaryReviewCount(data.review_count)
      }
      setLoading(false)
    })
  }, [shopId])

  async function handleGenerate() {
    setGenerating(true)
    setError('')
    const result = await generateAiSummary(shopId)
    if ('summary' in result) {
      setSummary(result.summary)
      setSummaryReviewCount(reviewCount)
    } else {
      setError(result.error)
    }
    setGenerating(false)
  }

  if (loading) return null
  if (reviewCount < 3 && !summary) return null

  // 리뷰가 요약 시점보다 많이 늘어났으면 다시 생성 추천
  const isStale = summary && reviewCount - summaryReviewCount >= 5

  return (
    <div style={{
      background: `${accentColor}08`, border: `1px solid ${accentColor}30`,
      borderRadius: '12px', padding: '14px', marginBottom: '20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
        <AppIcon name="sparkle" size={14} />
        <span style={{ fontSize: '13px', fontWeight: 900, color: accentColor }}>AI 리뷰 요약</span>
      </div>

      {summary ? (
        <>
          <p style={{ fontSize: '13px', lineHeight: 1.7, color: 'var(--text)', marginBottom: isStale ? '10px' : 0 }}>
            {summary}
          </p>
          {isStale && (
            <button
              onClick={handleGenerate}
              disabled={generating}
              style={{
                fontSize: '12px', color: accentColor, background: 'none',
                border: 'none', cursor: 'pointer', textDecoration: 'underline', fontWeight: 700,
              }}
            >
              {generating ? '업데이트 중...' : '새 리뷰 반영해서 다시 요약하기'}
            </button>
          )}
        </>
      ) : (
        <div>
          <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '10px' }}>
            리뷰 {reviewCount}개를 AI가 요약해드릴게요.
          </p>
          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{
              padding: '8px 16px', borderRadius: '8px',
              background: generating ? 'var(--border)' : accentColor,
              color: '#fff', border: 'none',
              fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {generating ? '요약 생성 중...' : <><AppIcon name="sparkle" size={13} color="#fff" style={{ marginRight: 4, verticalAlign: '-2px' }} />AI 요약 생성하기</>}
          </button>
        </div>
      )}

      {error && (
        <p style={{ fontSize: '12px', color: 'var(--red)', marginTop: '8px' }}>{error}</p>
      )}
    </div>
  )
}