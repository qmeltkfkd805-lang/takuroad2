import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const APPLY = process.argv.includes('--apply')

const candidates = [
  {
    tagNames: ['전지적 독자 시점'],
    type: 'collab_cafe',
    title: '전지적 독자 시점 콜라보 카페 - 한여름의 유람',
    start_date: '2026-07-31',
    end_date: '2026-08-17',
    place_name: '일오일 빌딩',
    place_addr: '서울특별시 마포구 성미산로 151-1',
    description: '전지적 독자 시점의 여름 테마 콜라보 카페. 방문 전 공식 안내에서 운영 방식과 품절 정보를 확인해 주세요.',
    source_urls: ['https://www.otamonth.com/ko/categories/COLLAB', 'https://get-duck.com/calendar/'],
    ticket_urls: [],
  },
  {
    tagNames: [],
    type: 'exhibition',
    title: 'K-일러스트레이션페어 마곡 2026',
    start_date: '2026-08-20',
    end_date: '2026-08-23',
    place_name: '코엑스마곡',
    place_addr: '서울특별시 강서구 마곡중앙로 143',
    hours_info: '11:00~18:00 (관람 종료 30분 전 매표 및 입장 마감)',
    entry_info: '현장 10,000원, 2차 사전예매 7,000원(8월 18일 23:59까지)',
    description: '웹툰·만화·게임·애니메이션을 포함한 일러스트레이션 작품과 캐릭터·출판·아트 상품을 만나는 전문 페어입니다.',
    source_urls: ['https://k-illustrationfair.com/magok/page/71', 'https://www.k-illustrationfair.com/magok/page/51'],
    ticket_urls: ['https://front.maketicket.co.kr/ticket/GD2602839'],
  },
  {
    tagNames: ['무민'],
    type: 'popup',
    title: '무민 팝업 IN 신세계 강남 센트럴',
    start_date: '2026-08-07',
    end_date: '2026-08-17',
    place_name: '신세계백화점 강남점 센트럴시티 1층 오픈스테이지',
    place_addr: '서울특별시 서초구 신반포로 176',
    hours_info: '10:00~22:00',
    description: '무민 골짜기의 여름을 테마로 한 팝업스토어로 특별 이벤트와 신규 굿즈를 선보입니다.',
    source_urls: ['https://colley.kr/colley-post/1433116454', 'https://www.instagram.com/moominshop_kr/'],
    ticket_urls: [],
  },
  {
    tagNames: ['먼작귀', '치이카와'],
    type: 'popup',
    title: '먼작귀 치이카와 스시 팝업스토어',
    start_date: '2026-08-01',
    end_date: '2026-08-14',
    place_name: '무신사 스토어 성수',
    place_addr: '서울특별시 성동구 성수이로 74',
    hours_info: '11:00~22:00',
    entry_info: '일부 품목은 1인 1개 구매 제한. 현장 상황에 따라 상품 입고 일정이 변경될 수 있습니다.',
    description: '치이카와 스시 테마의 상품과 굿즈를 만날 수 있는 팝업스토어입니다.',
    source_urls: ['https://colley.kr/colley-post/1615338369'],
    ticket_urls: ['https://buly.kr/8IyOtvJ'],
  },
  {
    tagNames: ['명탐정 코난'],
    type: 'official_event',
    title: '명탐정 코난 추리게임 팝업 - 할로윈의 웨딩 미스터리',
    start_date: '2026-07-17',
    end_date: '2026-08-30',
    place_name: '홍대 SKBD 지하 1층',
    place_addr: '서울특별시 마포구 홍대 일대',
    entry_info: '일반권 35,000원. 여러 참가자가 약 2시간 동안 함께 진행하는 중상급 난이도의 추리게임입니다.',
    description: '팀을 이뤄 행사장 곳곳의 단서를 수집하고 사건의 진실을 밝히는 명탐정 코난 체험형 추리게임입니다.',
    source_urls: ['https://colley.kr/colley-post/1706725031'],
    ticket_urls: [],
  },
  {
    tagNames: ['원피스', 'ONE PIECE'],
    type: 'exhibition',
    title: '원피스 대해적시대 아시아 투어 - 워터월드 제주',
    start_date: '2026-07-04',
    end_date: '2027-01-03',
    place_name: '워터월드 제주',
    place_addr: '제주특별자치도 서귀포시 월드컵로 33',
    description: '빛과 사운드, 실제 물을 활용해 원피스의 명장면과 세계관을 체험하는 몰입형 워터 미디어 전시입니다. 엘바프 테마 카페와 에그헤드 전시, 포토존도 운영됩니다.',
    source_urls: ['https://colley.kr/colley-post/821256813'],
    ticket_urls: ['https://be-mill.com/'],
  },
]

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 없습니다.')

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

function compact(row) {
  return Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined))
}

async function main() {
  const { data: existing, error: existingError } = await db
    .from('events')
    .select('id,title,start_date,end_date')
    .gte('end_date', '2026-08-11')
  if (existingError) throw existingError

  const allNames = [...new Set(candidates.flatMap((item) => item.tagNames))]
  const { data: tags, error: tagError } = await db.from('tags').select('id,name,slug').in('name', allNames)
  if (tagError) throw tagError

  const results = []
  for (const candidate of candidates) {
    const duplicate = (existing ?? []).find((row) =>
      row.title.trim().toLocaleLowerCase('ko-KR') === candidate.title.trim().toLocaleLowerCase('ko-KR') ||
      (row.start_date === candidate.start_date && row.title.includes(candidate.title.split(' - ')[0]))
    )
    if (duplicate) {
      results.push({ title: candidate.title, status: 'skip-duplicate', id: duplicate.id })
      continue
    }

    const tag = candidate.tagNames.map((name) => (tags ?? []).find((item) => item.name === name)).find(Boolean)
    const row = compact({
      tag_id: tag?.id ?? null,
      type: candidate.type,
      title: candidate.title,
      start_date: candidate.start_date,
      end_date: candidate.end_date,
      place_name: candidate.place_name,
      place_addr: candidate.place_addr,
      hours_info: candidate.hours_info,
      entry_info: candidate.entry_info,
      description: candidate.description,
      source_urls: candidate.source_urls,
      ticket_urls: candidate.ticket_urls,
      updated_at: new Date().toISOString(),
    })

    if (!APPLY) {
      results.push({ title: candidate.title, status: 'dry-run', tag: tag?.name ?? null })
      continue
    }

    const { data, error } = await db.from('events').insert(row).select('id').single()
    if (error) results.push({ title: candidate.title, status: 'error', message: error.message })
    else results.push({ title: candidate.title, status: 'inserted', id: data.id, tag: tag?.name ?? null })
  }

  console.table(results)
  if (!APPLY) console.log('검토 전용 실행입니다. 등록하려면 --apply를 추가하세요.')
  if (results.some((item) => item.status === 'error')) process.exitCode = 1
}

main().catch((error) => {
  console.error(error.message ?? error)
  process.exitCode = 1
})
