import { createClient } from '@supabase/supabase-js'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const placeResult = await db.from('places').insert({
  slug: 'waterworld-jeju',
  name: '워터월드 제주',
  place_type: 'CULTURE_SPACE',
  addr: '제주특별자치도 서귀포시 월드컵로 33',
  region: '제주',
  district: '서귀포시',
  lat: 33.24529508944007,
  lng: 126.50869807186983,
  kakao_place_id: '978165287',
  category_name: '여행 > 관광,명소 > 테마파크',
  parking: true,
  parking_note: '주차 가능\n주차요금 무료',
}).select('id').single()
if (placeResult.error) throw placeResult.error

const placeId = placeResult.data.id
const mapResult = await db.from('place_address_map').upsert({
  addr: '제주특별자치도서귀포시월드컵로33',
  place_id: placeId,
}, { onConflict: 'addr' })
if (mapResult.error) throw mapResult.error

const eventResult = await db.from('events').update({
  place_id: placeId,
  place_name: '워터월드 제주',
  place_addr: '제주특별자치도 서귀포시 월드컵로 33',
  place_lat: 33.24529508944007,
  place_lng: 126.50869807186983,
  parking: true,
  parking_note: '주차 가능\n주차요금 무료',
  updated_at: new Date().toISOString(),
}).eq('id', '57e9a311-c69c-4d16-9b5b-e94abb60fc63')
  .select('id,title,place_id,place_name,place_addr,parking,parking_note').single()
if (eventResult.error) throw eventResult.error
console.log(JSON.stringify(eventResult.data, null, 2))
