import { createClient } from '@supabase/supabase-js'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const [events, tags, places] = await Promise.all([
  db.from('events').select('*').ilike('title', '%캐릭캐릭%'),
  db.from('tags').select('*').ilike('name', '%캐릭캐릭%'),
  db.from('places').select('*').or('name.ilike.%애니메이트%,name.ilike.%AK플라자 홍대%,name.ilike.%삼정타워%'),
])

for (const result of [events, tags, places]) if (result.error) throw result.error
console.log(JSON.stringify({ events: events.data, tags: tags.data, places: places.data }, null, 2))

const kakaoKey = process.env.KAKAO_REST_KEY || process.env.NEXT_PUBLIC_KAKAO_REST_KEY
if (kakaoKey) {
  const response = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent('애니메이트카페 홍대점')}&size=5`, {
    headers: { Authorization: `KakaoAK ${kakaoKey}` },
  })
  console.log(JSON.stringify({ kakao: await response.json() }, null, 2))
}