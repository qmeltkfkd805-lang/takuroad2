import {createClient} from '@supabase/supabase-js'
import {config} from 'dotenv'
config({path:'../.env.local'})
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY)
const [events,places,tags]=await Promise.all([
 db.from('events').select('id,title,start_date,end_date').or('title.ilike.%인디애니%,title.ilike.%Indie-Ani%'),
 db.from('places').select('*').or('name.ilike.%CGV연남%,name.ilike.%CGV 연남%,addr.ilike.%동교동 167-13%'),
 db.from('tags').select('*').or('name.ilike.%인디애니%,name.ilike.%독립애니%')
])
for(const r of [events,places,tags])if(r.error)throw r.error
console.log(JSON.stringify({events:events.data,places:places.data,tags:tags.data},null,2))
