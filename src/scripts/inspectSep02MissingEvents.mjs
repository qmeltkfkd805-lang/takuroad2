import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const searches = ['PEACH-PIT', '캐릭캐릭체인지', '캐릭캐릭 체인지']
const events = {}
for (const term of searches) {
  const result = await db
    .from('events')
    .select('id,title,start_date,end_date,place_id,place_name,place_detail,shop_id,series_key,cover_url,ticket_urls,source_urls')
    .or(`title.ilike.%${term}%,description.ilike.%${term}%`)
  if (result.error) throw result.error
  events[term] = result.data
}

const places = await db
  .from('places')
  .select('*')
  .or('name.ilike.%아이파크몰 용산%,addr.ilike.%한강대로23길 55%')
if (places.error) throw places.error

console.log(JSON.stringify({ events, places: places.data }, null, 2))
