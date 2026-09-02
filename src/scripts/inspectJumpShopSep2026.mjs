import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const events = await db.from('events').select('*').or('title.ilike.%JUMP SHOP%,title.ilike.%점프샵%').order('start_date', { ascending: false })
if (events.error) throw events.error
const places = await db.from('places').select('*').or('name.ilike.%신세계백화점 강남%,addr.ilike.%신반포로 176%')
if (places.error) throw places.error
const tags = await db.from('tags').select('*').or('name.ilike.%점프%,slug.ilike.%jump%')
if (tags.error) throw tags.error
console.log(JSON.stringify({ events: events.data, places: places.data, tags: tags.data }, null, 2))
