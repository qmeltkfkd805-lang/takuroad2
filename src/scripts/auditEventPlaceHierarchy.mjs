import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '../.env.local' })

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const suspicious = [
  '애니메이트', '애니플러스샵', '리밋션', 'LIMITION', 'CGV 연남', '판교역',
  '피규어프레소', '투니크', '나이스고스트', '무신사 스토어', '팬베이스',
  '이머시브플랫폼', '덕스', 'DUEX', '서교플레이스', '굿즈모먼트',
  '브이스퀘어', '애니팝', '스테이지엑스',
]

const { data: places, error: placesError } = await db
  .from('places')
  .select('id,slug,name,place_type,addr,lat,lng,kakao_place_id,parking,parking_note,created_at')
  .order('created_at', { ascending: false })
if (placesError) throw placesError

const targets = places.filter((place) => suspicious.some((term) => place.name?.includes(term)))
const ids = targets.map((place) => place.id)
const { data: events, error: eventsError } = ids.length
  ? await db
      .from('events')
      .select('id,title,place_id,place_name,place_addr,place_detail,place_lat,place_lng,parking,parking_note,start_date,end_date')
      .in('place_id', ids)
      .order('start_date', { ascending: false })
  : { data: [], error: null }
if (eventsError) throw eventsError

const parentTerms = ['삼정타워', 'AK플라자', '딜라이트', '롯데백화점 잠실', '롯데월드 쇼핑몰', 'LC타워', '스타시티', '대림창고']
const parents = places.filter((place) => parentTerms.some((term) => place.name?.includes(term)))

console.log(JSON.stringify({ targets, events, parents }, null, 2))
