import type { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'

const SITE_URL = 'https://takuroad.kr'

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
    const [shops, works, events, places, routes] = await Promise.all([
      supabase
        .from('shops')
        .select('slug, updated_at')
        .in('status', ['active', 'temporary_closed', 'closed'])
        .not('slug', 'is', null),
      supabase.from('tags').select('slug, updated_at').not('slug', 'is', null),
      supabase.from('events').select('id, updated_at'),
      supabase.from('places').select('slug, updated_at').not('slug', 'is', null),
      supabase
        .from('routes')
        .select('share_token, updated_at')
        .or('is_shared.eq.true,is_official.eq.true')
        .not('share_token', 'is', null),
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
          lastModified: work.updated_at,
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
