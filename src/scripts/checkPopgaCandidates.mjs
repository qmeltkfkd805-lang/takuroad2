import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const terms = ['원신','히얼','이토 준지','짬생','산리오','방탈출','치비구루미']
const out = {}
for (const term of terms) {
  const r = await db.from('events').select('id,title,start_date,end_date,place_name').or(`title.ilike.%${term}%,description.ilike.%${term}%`)
  if (r.error) throw r.error
  out[term] = r.data
}
console.log(JSON.stringify(out, null, 2))
