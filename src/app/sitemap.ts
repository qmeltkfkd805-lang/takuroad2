import type { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'
import { fetchAllRows } from '@/lib/supabase/fetchAll'

// 실제 주소는 www — takuroad.kr 로 들어오면 www 로 넘어간다(Vercel 도메인 설정). 사이트맵·robots 의 주소도 www 로 맞춘다
// (예전엔 takuroad.kr 로 적혀 있어서 사이트맵의 모든 주소가 넘겨주기(리다이렉트)를 거쳤다)
const SITE_URL = 'https://www.takuroad.kr'

const staticPaths = [
  '/',
  '/map',
  '/shops',
  '/events',
  '/events/calendar',
  '/routes',
  '/community',
  '/about',
  '/support/notice',
  '/support/faq',
  '/support/contact',
  '/policies/terms',
  '/policies/privacy',
  '/policies/copyright',
  '/policies/community',
  '/policies/disclaimer',
  '/policies/rights',
] as const

type SitemapRow = {
  path: string
  lastModified?: string | Date | null
  changeFrequency?: MetadataRoute.Sitemap[number]['changeFrequency']
  priority?: number
}

function toSitemapEntry({
  path,
  lastModified,
  changeFrequency = 'weekly',
  priority = 0.7,
}: SitemapRow): MetadataRoute.Sitemap[number] {
  return {
    url: `${SITE_URL}${path}`,
    ...(lastModified ? { lastModified } : {}),
    changeFrequency,
    priority,
  }
}

function staticEntries(): MetadataRoute.Sitemap {
  return staticPaths.map((path) =>
    toSitemapEntry({
      path,
      changeFrequency: path === '/' ? 'daily' : 'weekly',
      priority: path === '/' ? 1 : path.startsWith('/policies/') ? 0.3 : 0.7,
    }),
  )
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return staticEntries()
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  })

  try {
    /* 한 번 조회는 1,000줄까지라, 샵(1,000곳 넘음)·작품(2,500개 넘음)이 사이트맵에서 잘려
       검색엔진에 알리지 못한 페이지가 많았다 → 전부 나눠서 끝까지 받는다 */
    const [shops, works, events, places, routes] = await Promise.all([
      fetchAllRows<any>((from, to) => supabase
        .from('shops')
        .select('id, slug, updated_at')
        .in('status', ['active', 'temporary_closed', 'closed'])
        .not('slug', 'is', null)
        .order('id', { ascending: true })
        .range(from, to)),
      // tags 에는 updated_at 칸이 없다 — 예전엔 이 조회가 통째로 실패해서 작품 페이지가 사이트맵에 하나도 안 들어갔다
      fetchAllRows<any>((from, to) => supabase.from('tags').select('id, slug, created_at').not('slug', 'is', null).order('id', { ascending: true }).range(from, to)),
      fetchAllRows<any>((from, to) => supabase.from('events').select('id, updated_at').order('id', { ascending: true }).range(from, to)),
      fetchAllRows<any>((from, to) => supabase.from('places').select('id, slug, updated_at').not('slug', 'is', null).order('id', { ascending: true }).range(from, to)),
      fetchAllRows<any>((from, to) => supabase
        .from('routes')
        .select('id, share_token, updated_at')
        .or('is_shared.eq.true,is_official.eq.true')
        .not('share_token', 'is', null)
        .order('id', { ascending: true })
        .range(from, to)),
    ])

    const dynamicEntries: MetadataRoute.Sitemap = [
      ...(shops.data ?? []).map((shop) =>
        toSitemapEntry({
          path: `/shop/${encodeURIComponent(shop.slug)}`,
          lastModified: shop.updated_at,
          priority: 0.8,
        }),
      ),
      ...(works.data ?? []).map((work) =>
        toSitemapEntry({
          path: `/work/${encodeURIComponent(work.slug)}`,
          lastModified: work.created_at,
          priority: 0.8,
        }),
      ),
      ...(events.data ?? []).map((event) =>
        toSitemapEntry({
          path: `/event/${encodeURIComponent(String(event.id))}`,
          lastModified: event.updated_at,
          changeFrequency: 'daily',
          priority: 0.8,
        }),
      ),
      ...(places.data ?? []).map((place) =>
        toSitemapEntry({
          path: `/place/${encodeURIComponent(place.slug)}`,
          lastModified: place.updated_at,
        }),
      ),
      ...(routes.data ?? []).map((route) =>
        toSitemapEntry({
          path: `/route/${encodeURIComponent(route.share_token)}`,
          lastModified: route.updated_at,
        }),
      ),
    ]

    return [...staticEntries(), ...dynamicEntries]
  } catch {
    return staticEntries()
  }
}
