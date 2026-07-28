import { NextResponse } from 'next/server'

/* 카카오 로컬 검색 프록시 — 브라우저 대신 서버에서 카카오 REST API를 호출한다.
   ⭐ 키가 서버에만 있어 노출되지 않고, 카카오의 도메인(CORS) 제약도 안 받는다.
   ⭐ 키는 서버 전용 KAKAO_REST_KEY 우선, 없으면 기존 NEXT_PUBLIC_KAKAO_REST_KEY로 폴백. */

export const dynamic = 'force-dynamic'

const KEY = process.env.KAKAO_REST_KEY || process.env.NEXT_PUBLIC_KAKAO_REST_KEY

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const query = (searchParams.get('query') || '').trim()
  const type = searchParams.get('type') || 'keyword'   // 'keyword' | 'address'

  if (!query) return NextResponse.json({ documents: [] })
  if (!KEY) return NextResponse.json({ error: 'KAKAO key not configured' }, { status: 500 })

  const endpoint = type === 'address'
    ? `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query)}`
    : `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=5`

  try {
    const res = await fetch(endpoint, {
      headers: { Authorization: `KakaoAK ${KEY}` },
      cache: 'no-store',
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.ok ? 200 : res.status })
  } catch {
    return NextResponse.json({ documents: [], error: 'kakao request failed' }, { status: 502 })
  }
}
