import { createClient } from '@supabase/supabase-js'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
let { data: place } = await db.from('places').select('id').eq('kakao_place_id', '1177615458').maybeSingle()

if (!place) {
  const result = await db.from('places').insert({
    slug: 'seogyo-place',
    name: '서교플레이스',
    place_type: 'EVENT_HALL',
    addr: '서울 마포구 홍익로2길 7',
    region: '서울',
    district: '마포구',
    lat: 37.5542683641458,
    lng: 126.92331494603,
    kakao_place_id: '1177615458',
    category_name: '서비스,산업 > 전문대행 > 공간대여',
  }).select('id').single()
  if (result.error) throw result.error
  place = result.data
}

const mapped = await db.from('place_address_map').upsert({
  addr: '서울마포구홍익로2길7',
  place_id: place.id,
}, { onConflict: 'addr' })
if (mapped.error) throw mapped.error

const result = await db.from('events').update({
  place_id: place.id,
  place_name: '서교플레이스',
  place_addr: '서울 마포구 홍익로2길 7',
  place_lat: 37.5542683641458,
  place_lng: 126.92331494603,
  place_detail: '지하 1층 SKBD',
  updated_at: new Date().toISOString(),
}).eq('id', 'aca71461-cefb-4317-841e-6d512c4f92d0')
  .select('id,title,place_id,place_name,place_addr,place_detail').single()
if (result.error) throw result.error
console.log(JSON.stringify(result.data, null, 2))
