import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const queries = await Promise.all([
  db.from('events').select('id,title,start_date,end_date,place_id,place_name,place_addr,shop_id').or('title.ilike.%나가노마켓%,title.ilike.%나가노 마켓%,title.ilike.%농담곰%'),
  db.from('places').select('*').or('name.ilike.%0%SEOUL%,name.ilike.%제로퍼센트%,addr.ilike.%월드컵북로2길 29%'),
  db.from('shops').select('id,name,addr,place_id').or('name.ilike.%나가노%,name.ilike.%0%SEOUL%,name.ilike.%제로퍼센트%,addr.ilike.%월드컵북로2길 29%'),
  db.from('tags').select('id,name,slug').or('name.ilike.%나가노%,name.ilike.%농담곰%,slug.ilike.%nagano%'),
])

for (const result of queries) if (result.error) throw result.error
console.log(JSON.stringify({ events: queries[0].data, places: queries[1].data, shops: queries[2].data, tags: queries[3].data }, null, 2))
