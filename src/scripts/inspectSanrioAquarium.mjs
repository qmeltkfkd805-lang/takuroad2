import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '../.env.local' })
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY)
const [events,places,tags]=await Promise.all([
 db.from('events').select('id,title,start_date,end_date').or('title.ilike.%머메이드%,title.ilike.%아쿠아리움%'),
 db.from('places').select('*').or('name.ilike.%롯데월드 아쿠아리움%,name.ilike.%롯데월드몰%'),
 db.from('tags').select('*').ilike('name','%산리오%')
])
for(const r of [events,places,tags])if(r.error)throw r.error
console.log(JSON.stringify({events:events.data,places:places.data,tags:tags.data},null,2))
