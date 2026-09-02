import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const events = await db.from('events').select('*').or('title.ilike.%피카츄의 가을 소풍%,title.ilike.%피카츄의 한국 나들이%,title.ilike.%한복%피카츄%')
if (events.error) throw events.error
const places = await db.from('places').select('*').or('name.ilike.%하이커%,name.ilike.%한국관광공사%,name.ilike.%인천국제공항%,addr.ilike.%청계천로 40%,addr.ilike.%공항로 271%')
if (places.error) throw places.error
const tags = await db.from('tags').select('*').or('name.ilike.%포켓몬%,slug.ilike.%pokemon%')
if (tags.error) throw tags.error
console.log(JSON.stringify({ events: events.data, places: places.data, tags: tags.data }, null, 2))
