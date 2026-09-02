import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

let result = await db.from('places').select('*').eq('kakao_place_id', '13322882').maybeSingle()
if (result.error) throw result.error
if (!result.data) {
  result = await db.from('places').insert({
    slug: 'time-villas-suwon-13322882',
    name: '타임빌라스 수원점',
    place_type: 'SHOPPING_MALL',
    addr: '경기 수원시 권선구 세화로 134',
    region: '경기',
    district: '수원시 권선구',
    lat: 37.26398458973233,
    lng: 126.99733379949105,
    kakao_place_id: '13322882',
    category_name: '가정,생활 > 복합쇼핑몰',
    parking: true,
    parking_note: '주차 가능(유료)\n최초 30분 무료\n초과 10분당 1,000원\n1만원 이상 구매 시 1시간, 3만원 이상 2시간, 5만원 이상 3시간, 10만원 이상 4시간 무료',
    system_created: false,
  }).select('*').single()
  if (result.error) throw result.error
}
console.log(JSON.stringify(result.data, null, 2))
