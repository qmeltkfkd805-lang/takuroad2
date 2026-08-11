import { createClient } from '@supabase/supabase-js'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const placeResult = await db.from('places').insert({
  slug: 'duex-hongdae',
  name: '덕스(DUEX)',
  place_type: 'EXHIBITION',
  addr: '서울 마포구 양화로 186',
  region: '서울',
  district: '마포구',
  lat: 37.5576983954636,
  lng: 126.926036726927,
  kakao_place_id: '2077723370',
  category_name: '문화,예술 > 문화시설 > 전시관',
}).select('id').single()
if (placeResult.error) throw placeResult.error

const placeId = placeResult.data.id
const mapResult = await db.from('place_address_map').upsert({
  addr: '서울마포구양화로186',
  place_id: placeId,
}, { onConflict: 'addr' })
if (mapResult.error) throw mapResult.error

const eventResult = await db.from('events').update({
  place_id: placeId,
  place_name: '덕스(DUEX)',
  place_addr: '서울 마포구 양화로 186',
  place_lat: 37.5576983954636,
  place_lng: 126.926036726927,
  place_detail: 'LC타워 B3층',
  updated_at: new Date().toISOString(),
}).eq('id', '5fdfcc29-98fe-435d-b577-2ed81bc48b0e').select('id,title,place_id,place_name,place_addr,place_detail').single()
if (eventResult.error) throw eventResult.error
console.log(JSON.stringify(eventResult.data, null, 2))
