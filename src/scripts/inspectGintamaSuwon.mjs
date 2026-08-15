import { createClient } from '@supabase/supabase-js'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const [events, places, tags] = await Promise.all([
  db.from('events').select('*').or('title.ilike.%은혼%,title.ilike.%요시와라%').order('start_date'),
  db.from('places').select('*').or('name.ilike.%AK플라자 수원%,addr.ilike.%덕영대로 924%'),
  db.from('tags').select('*').or('name.ilike.%은혼%,slug.ilike.%gintama%'),
])
for (const result of [events, places, tags]) if (result.error) throw result.error
console.log(JSON.stringify({ events: events.data, places: places.data, tags: tags.data }, null, 2))
