import { createClient } from '@supabase/supabase-js'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const titles = ['명탐정 코난 WIND FESTIVAL 팝업스토어','우리길드 아이돌 팝업스토어','명일방주 앰비언스 시네스티시아 팝업스토어','원신 한여름 파티 팝업 스토어','쿠이료코전 & 「던전밥」 미궁탐색전','하이큐 애니메이트 콜라보 카페','이토 준지 X 산리오 캐릭터즈 X 나이스고스트클럽 팝업','약사의 혼잣말 X 애니메이트 콜라보 카페','가정교사 히트맨 리본! Gratte','반프레스토 X 치비구루미 팝업스토어','투니크 X 여친, 빌리겠습니다 콜라보 카페','귀멸의 칼날 : 전집중 展','약사의 혼잣말 특별전']
const [{data: events, error: ee}, {data: tags, error: te}] = await Promise.all([
  db.from('events').select('id,title,start_date,end_date,place_name').or(titles.map(t => `title.ilike.%${t.replaceAll(',','')}%`).join(',')),
  db.from('tags').select('id,name,slug').order('name'),
])
if (ee) throw ee
if (te) throw te
console.log(JSON.stringify({events, tags: tags.filter(t => /코난|길드|명일|원신|던전|하이큐|이토|약사|리본|여친|귀멸/.test(t.name))}, null, 2))

const queries = ['애니팝 굿즈샵','부산 삼정타워','에스팩토리 성수','나이스고스트클럽 성수','무신사 스토어 명동','투니크 유니버스점','스테이지 비밀','AK플라자 홍대','더현대 서울','아이파크몰 용산']
const key = process.env.NEXT_PUBLIC_KAKAO_REST_KEY
for (const query of queries) {
  const response = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}`, {headers:{Authorization:`KakaoAK ${key}`}})
  const json = await response.json()
  console.log(JSON.stringify({query, places:(json.documents ?? []).slice(0,3).map(({id,place_name,address_name,road_address_name,x,y,category_name})=>({id,place_name,address_name,road_address_name,x,y,category_name}))}, null, 2))
}
