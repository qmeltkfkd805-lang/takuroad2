import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { readFile, mkdir, writeFile } from 'node:fs/promises'

config({path:'../.env.local'})
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY)
const targets=[
  {id:'8be154d4-78b2-4d47-92b4-da86ea72f1b0',key:'hongdae',file:'tmp/inuyasha/3.png'},
  {id:'fe1237d2-0c9f-427c-81e1-64e940744567',key:'suwon',file:'tmp/inuyasha/7.png'},
]
const ids=targets.map(x=>x.id)
const old=await db.from('events').select('id,title,cover_url').in('id',ids)
if(old.error)throw old.error
await mkdir('scripts/event-backups',{recursive:true})
await writeFile(`scripts/event-backups/before-inuyasha-poster-fix-${Date.now()}.json`,JSON.stringify(old.data,null,2))

const out=[]
for(const target of targets){
  const storagePath=`covers/2026/inuyasha-popup-${target.key}-main-poster.png`
  const upload=await db.storage.from('event-goods').upload(storagePath,await readFile(target.file),{contentType:'image/png',upsert:true})
  if(upload.error)throw upload.error
  const cover_url=db.storage.from('event-goods').getPublicUrl(storagePath).data.publicUrl
  const r=await db.from('events').update({cover_url,updated_at:new Date().toISOString()}).eq('id',target.id).select('id,title,cover_url').single()
  if(r.error)throw r.error
  out.push(r.data)
}
console.log(JSON.stringify(out,null,2))
