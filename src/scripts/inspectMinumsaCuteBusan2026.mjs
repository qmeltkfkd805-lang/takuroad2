import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const event = await db.from('events').select('*').or('title.ilike.%문장 너머의 세계%,title.ilike.%오늘의귀여움%,title.ilike.%민음사%')
if (event.error) throw event.error
const place = await db.from('places').select('*').or('name.ilike.%삼정타워%,addr.ilike.%중앙대로 672%')
if (place.error) throw place.error
const tags = await db.from('tags').select('*').or('name.ilike.%오늘의귀여움%,name.ilike.%민음사%,slug.ilike.%cute%')
if (tags.error) throw tags.error
console.log(JSON.stringify({ events: event.data, places: place.data, tags: tags.data }, null, 2))
