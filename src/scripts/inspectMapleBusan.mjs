import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const [events, places, tags] = await Promise.all([
  db.from('events').select('id,title,start_date,end_date,place_name').or('title.ilike.%메이플%,title.ilike.%MAPLESTORY%'),
  db.from('places').select('*').or('name.ilike.%롯데월드%부산%,addr.ilike.%동부산관광로 42%'),
  db.from('tags').select('id,name').ilike('name', '%메이플%'),
])

for (const result of [events, places, tags]) if (result.error) throw result.error
console.log(JSON.stringify({ events: events.data, places: places.data, tags: tags.data }, null, 2))
