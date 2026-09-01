import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({path:'../.env.local'})
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY)
const parking_note='주차 가능(유료)\n아쿠아리움 당일 이용객은 10분당 200원, 최대 4시간 4,800원\n4시간 초과분은 일반 주차요금 적용\n일반요금은 10:00~20:00 10분당 500원, 그 외 시간 10분당 200원'
const r=await db.from('events').update({parking_note,updated_at:new Date().toISOString()}).eq('id','6c646f28-2da7-4d32-b248-52a19e12bbe5').select('id,title,parking,parking_note').single()
if(r.error)throw r.error
console.log(JSON.stringify(r.data,null,2))
