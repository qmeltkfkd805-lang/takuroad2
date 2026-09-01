import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const terms = ['시든 꽃', '태하의 방', '우리 길드 아이돌', '달무리', '뱅드림', '치비구루미', '반프레스토']
const events = {}
for (const term of terms) {
  const result = await db.from('events').select('id,title,start_date,end_date,place_name,place_id').or(`title.ilike.%${term}%,description.ilike.%${term}%`)
  if (result.error) throw result.error
  events[term] = result.data
}

const places = await db.from('places').select('*').or('name.ilike.%아이파크몰 용산%,addr.ilike.%한강대로23길 55%')
if (places.error) throw places.error
const tags = await db.from('tags').select('*').or('name.ilike.%시든 꽃%,name.ilike.%태하%,name.ilike.%뱅드림%')
if (tags.error) throw tags.error

console.log(JSON.stringify({ events, places: places.data, tags: tags.data }, null, 2))
