import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
for (const term of ['Re:제로', '장송의 프리렌', '오란고교', '프로젝트 세카이']) {
  const result = await db.from('events').select('id,title,start_date,end_date,place_name').ilike('title', `%${term}%`)
  if (result.error) throw result.error
  console.log(term, JSON.stringify(result.data))
}
