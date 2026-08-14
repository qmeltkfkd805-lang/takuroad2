import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const id = '5683c48f-79f0-49bd-9723-b9df17fd0f54'
const description = `TV 애니메이션 가정교사 히트맨 리본의 20주년 기념 비주얼과 한국 오리지널 굿즈를 만날 수 있는 팝업스토어입니다.

본인 인증을 완료한 계정으로 1인 1일 1매만 예약할 수 있으며 예약자 본인만 입장할 수 있습니다.
예약 시간에서 15분이 지나면 입장이 제한되며 모바일 예약 화면 캡처본은 사용할 수 없습니다.
만 14세 미만은 법정 보호자 예약 후 보호자 1인과 동반해야 하며 가족관계증명서를 확인합니다.`
const { error } = await supabase.from('events').update({
  reserve_start: '2026-08-05',
  reserve_end: '2026-08-30',
  entry_info: '사전예약 후 입장\n현장예약 가능 (노쇼·잔여 인원 발생 시)',
  ticket_urls: [{
    url: 'https://www.mcomics.co.kr/shop/category/REBORN',
    label: '팝업 예약하기',
  }],
  description,
  updated_at: new Date().toISOString(),
}).eq('id', id)

if (error) throw error

const { data, error: readError } = await supabase
  .from('events')
  .select('title,reserve_start,reserve_end,entry_info,ticket_urls,description')
  .eq('id', id)
  .single()

if (readError) throw readError
console.log(JSON.stringify(data, null, 2))
