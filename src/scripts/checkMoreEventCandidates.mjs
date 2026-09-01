import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const terms = ['인디애니','Indie-Ani','기븐','Given','전지적 독자','하츠네 미쿠','화이트아웃','캐릭캐릭']
const rows = []
for (const term of terms) {
  const result = await db.from('events').select('id,title,start_date,end_date,place_name').ilike('title', `%${term}%`)
  if (result.error) throw result.error
  rows.push({ term, events: result.data })
}
console.log(JSON.stringify(rows, null, 2))
