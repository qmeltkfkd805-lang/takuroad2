// ===== legacy path import guard (2026-09-18) =====
// 이 스크립트는 event-goods 버킷의 고정 경로에 upsert:true 로 업로드한다.
// 2026-09-18 중복 정리(49세트 / 111멤버 -> 49객체, 58,811,816 B 회수)로 그 경로들이
// 삭제됐다. 그대로 재실행하면 지운 중복이 되살아나거나 기존 객체를 덮어쓴다.
// 업로드를 content-addressed 로 전환하기 전까지 기본 실행을 막는다.
// 스크립트는 기록으로 보존한다. 삭제하지 말 것.
if (process.env.ALLOW_LEGACY_PATH_IMPORT !== 'I-UNDERSTAND-THIS-RECREATES-DUPLICATES') {
  console.error('legacy path import disabled')
  console.error('  script : fixInuyashaMainPosters.mjs')
  console.error('  reason : event-goods 고정 경로 upsert:true 업로드 - 2026-09-18 dedup 결과를 되돌린다')
  console.error('  unlock : $env:ALLOW_LEGACY_PATH_IMPORT="I-UNDERSTAND-THIS-RECREATES-DUPLICATES"')
  console.error('           해당 PowerShell 세션에서만 유효. setx 로 영구 설정하지 말 것.')
  process.exit(1)
}
// ===== /legacy path import guard =====
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
