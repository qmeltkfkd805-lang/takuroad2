import { createClient } from '@supabase/supabase-js'
import { mkdir, writeFile } from 'node:fs/promises'

const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY)
const {data:events,error}=await db.from('events').select('id,title,type,start_date,end_date,description').order('start_date')
if(error)throw error

const backupDir='scripts/event-description-backups'
await mkdir(backupDir,{recursive:true})
const stamp=new Date().toISOString().replaceAll(':','-').replaceAll('.','-')
await writeFile(`${backupDir}/before-expand-${stamp}.json`,JSON.stringify(events,null,2),'utf8')

function extra(event,text){
  if(event.type==='collab_cafe'){
    if(/메뉴/.test(text))return '작품의 분위기를 담은 공간 연출과 일러스트를 함께 감상하며 캐릭터별 요소를 찾아보는 재미가 있습니다.'
    return '작품의 분위기를 담은 메뉴와 공간 연출, 공식 상품을 함께 즐길 수 있습니다.'
  }
  if(event.type==='exhibition'){
    if(/체험|전시 콘텐츠|전시 연출/.test(text))return '캐릭터와 이야기의 흐름을 따라가며 작품을 입체적으로 돌아볼 수 있도록 구성된 행사입니다.'
    return '작품의 주요 장면과 설정을 다양한 전시 연출과 콘텐츠로 천천히 살펴볼 수 있습니다.'
  }
  if(event.type==='popup'){
    if(/공식 상품|굿즈|상품/.test(text))return '작품의 캐릭터와 분위기를 활용한 공간 연출도 함께 마련되어 팬들이 현장에서 작품의 매력을 즐길 수 있습니다.'
    return '작품의 캐릭터와 분위기를 담은 공식 상품과 현장 콘텐츠를 한자리에서 살펴볼 수 있습니다.'
  }
  return '작품의 캐릭터와 세계관을 현장에서 직접 만나고 관련 콘텐츠를 함께 즐길 수 있는 행사입니다.'
}

function format(event){
  let text=(event.description??'').trim()
  if(!text)text=`「${event.title}」의 작품과 캐릭터를 현장에서 만나는 공식 행사입니다.`
  if(text.length<125)text=`${text}\n\n${extra(event,text)}`
  return text
    .replace(/\.\s*(?=\S)/g,'.\n')
    .replace(/SUB\.\nST/g,'SUB.ST')
    .replace(/\n{3,}/g,'\n\n')
    .replace(/[ \t]+\n/g,'\n')
    .trim()
}

const results=[]
for(const event of events){
  const description=format(event)
  if(description===event.description){results.push({status:'UNCHANGED',title:event.title,length:description.length});continue}
  const r=await db.from('events').update({description,updated_at:new Date().toISOString()}).eq('id',event.id).select('id,title,description').single()
  if(r.error)throw r.error
  results.push({status:'UPDATED',title:r.data.title,length:r.data.description.length,description:r.data.description})
}
console.log(JSON.stringify({backup:`${backupDir}/before-expand-${stamp}.json`,total:events.length,updated:results.filter(x=>x.status==='UPDATED').length,unchanged:results.filter(x=>x.status==='UNCHANGED').length,results},null,2))
