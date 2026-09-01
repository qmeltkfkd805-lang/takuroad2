import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const [events, places, tags] = await Promise.all([
  db.from('events').select('id,title,start_date,end_date,place_name,place_id').or('title.ilike.%이누야샤%,description.ilike.%이누야샤%'),
  db.from('places').select('*').or('name.ilike.%AK PLAZA%,name.ilike.%AK플라자%,name.ilike.%AK&%'),
  db.from('tags').select('*').ilike('name', '%이누야샤%'),
])
for (const result of [events, places, tags]) if (result.error) throw result.error
console.log(JSON.stringify({ events: events.data, places: places.data, tags: tags.data }, null, 2))
