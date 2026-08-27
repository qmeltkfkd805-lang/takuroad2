import { createClient } from '@supabase/supabase-js'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const { data: events, error: eventsError } = await db
  .from('events')
  .select('id,title,start_date,end_date,place_name,place_addr')
  .gte('end_date', '2026-08-18')
  .order('start_date')
if (eventsError) throw eventsError

const terms = ['아이파크몰', '신세계백화점 강남', '롯데월드몰', '더현대 서울', '무신사 스토어 성수', '무신사 대림창고', '서브스트릿']
const places = []
for (const term of terms) {
  const { data, error } = await db
    .from('places')
    .select('id,name,addr,lat,lng,kakao_place_id,parking,parking_note')
    .ilike('name', `%${term}%`)
    .limit(10)
  if (error) throw error
  places.push({ term, rows: data })
}

const tagTerms = ['케로로', '포켓몬', '해즈빈', '점프', '이치방쿠지']
const tags = []
for (const term of tagTerms) {
  const { data, error } = await db.from('tags').select('id,name,slug,cover_url').ilike('name', `%${term}%`).limit(10)
  if (error) throw error
  tags.push({ term, rows: data })
}

console.log(JSON.stringify({ events, places, tags }, null, 2))
