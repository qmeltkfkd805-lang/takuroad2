import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
for (const term of ['하츠네 미쿠', 'Chocoanimal', '내 호수에 가둔 인어', '블리치 천년혈전', 'JUMP SHOP']) {
  const result = await db.from('events').select('id,title,start_date,end_date,place_id,place_name,place_addr,place_detail,shop_id')
    .ilike('title', `%${term}%`).order('start_date', { ascending: false })
  if (result.error) throw result.error
  console.log(`\n## ${term}\n${JSON.stringify(result.data, null, 2)}`)
}
const places = await db.from('places').select('*').or('name.ilike.%롯데월드%,name.ilike.%잠실%,addr.ilike.%올림픽로 240%')
if (places.error) throw places.error
console.log(`\n## places\n${JSON.stringify(places.data, null, 2)}`)
const shops = await db.from('shops').select('id,name,addr,place_id').or('name.ilike.%애니메이트카페%잠실%,addr.ilike.%올림픽로 240%')
if (shops.error) throw shops.error
console.log(`\n## shops\n${JSON.stringify(shops.data, null, 2)}`)
