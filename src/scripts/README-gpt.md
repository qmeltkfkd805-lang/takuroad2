# TAKUROAD 이벤트/굿즈 등록 스크립트 규칙 (GPT에게 붙여넣는 문서)

새 이벤트·굿즈를 스크립트로 등록시킬 때 **이 문서를 통째로 GPT에게 먼저 붙여넣는다.**
그러면 샵 연결과 지점 묶기가 자동으로 처리되어, 등록 후 손볼 일이 없다.

---

## 붙여넣을 내용 (여기부터)

```
[TAKUROAD 이벤트 등록 스크립트 규칙]

## 실행 환경
- 파일 위치: src/scripts/<작업이름>.mjs (ESM, top-level await 사용 가능)
- 실행: src/ 디렉터리에서 `node scripts/<작업이름>.mjs`
- 클라이언트는 서비스 롤 키로 만든다 (RLS 우회):

  import { createClient } from '@supabase/supabase-js'
  import { config } from 'dotenv'
  config({ path: '../.env.local' })
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

- 기존 행을 UPDATE 하는 스크립트는 반드시 먼저 백업 JSON을 남긴다:

  await mkdir('scripts/event-backups', { recursive: true })
  await writeFile(`scripts/event-backups/before-<작업이름>-${Date.now()}.json`, JSON.stringify(before.data, null, 2))

## 1) 샵 연결 — events.shop_id
shop_id가 비면 샵 상세의 "진행중인 이벤트"에 안 나온다.
장소(place_name/place_addr)만 넣으면 주소가 같아도 자동으로 이어지지 않는다.

  import { findShopId } from './lib/findShopId.mjs'

  event.shop_id = await findShopId(db, {
    placeId:  event.place_id,
    addr:     event.place_addr,
    nameHint: event.place_detail || event.place_name,
  })

- 후보가 정확히 1곳일 때만 id를 돌려준다. 같은 건물에 샵이 여러 개면 null이다.
- null이어도 그냥 두고 넘어간다. 사람이 샵 수정 화면에서 직접 고른다.
- shop_id가 채워지면 place_name / place_addr / place_lat / place_lng는 null로 둔다
  (샵이 곧 장소라서 중복 저장하지 않는다).

## 2) 지점 묶기 — events.series_key
여러 지점에서 하는 같은 이벤트(예: "○○ 팝업 (홍대점)", "○○ 팝업 (잠실점)")를 묶는 값.
안 묶으면 이벤트 목록에 같은 포스터가 지점 수만큼 뜬다.

insert 하기 직전에 반드시 이 헬퍼로 값을 정한다:

  import { resolveSeriesKey } from './lib/seriesKey.mjs'

  event.series_key = await resolveSeriesKey(db, {
    title:     event.title,        // 지점 꼬리표까지 포함한 원래 제목 그대로
    startDate: event.start_date,
    endDate:   event.end_date,
  })

규칙:
- series_key를 직접 문자열로 지어내지 말 것. 반드시 resolveSeriesKey가 돌려준 값을 쓴다.
  (이미 등록된 지점이 있으면 그 묶음에 합류하고, 없으면 새 키를 만들어 기존 형제들에게도 채워준다)
- 여러 지점을 한 스크립트에서 등록할 때는 지점마다 하나씩 insert 하고,
  각 insert 직전에 resolveSeriesKey를 다시 호출한다. (앞 지점이 이미 들어가 있어야 묶인다)
- 제목은 지점을 괄호로 붙인다: "AMNESIA WORLD Gratte (홍대점)".
  [잠실점], - 부산점 형식도 인식된다.
- 한 곳에서만 하는 이벤트는 resolveSeriesKey가 null을 돌려준다. 그대로 null로 둔다.
- 같은 이벤트의 지점들은 start_date / end_date를 똑같이 넣는다. 하루라도 다르면 안 묶인다.
- 회차가 다른 같은 제목의 이벤트(1기/2기 등)는 기간이 다르므로 자동으로 안 묶인다. 그대로 두면 된다.

## 3) 이벤트 기본 필드
- type: 'popup' | 'collab_cafe' | 'exhibition' | 'official_event'
- tag_id: 작품 태그 id. 반드시 채운다 (안 채우면 그 작품 팬에게 노출되지 않는다).
- title: "작품명 + 이벤트명" 형태. 지점이 여럿이면 끝에 "(○○점)".
- start_date / end_date: 'YYYY-MM-DD'
- cover_url: 포스터. 없으면 null로 두면 작품 커버가 대신 쓰인다.
- source_urls: 공식 사이트·SNS 배열. 기존 값이 있으면 합치되 중복은 제거한다.
- created_by / updated_by: 등록자 uuid. updated_at도 함께 갱신한다.

## 4) 하지 말 것
- events 테이블에 새 컬럼을 추가하거나 정책을 바꾸지 말 것. 스키마 변경은 migrations/로만 한다.
- 기존 행을 백업 없이 UPDATE 하지 말 것.
- series_key / shop_id를 추측해서 직접 문자열이나 id로 넣지 말 것. 반드시 위 헬퍼를 쓴다.
- 커버 이미지를 외부 URL 그대로 저장하지 말 것. event-goods 버킷의 covers/ 아래에 올리고
  getPublicUrl로 얻은 주소를 쓴다.
```

## (여기까지)

---

## 참고 — 헬퍼 위치

| 파일 | 하는 일 |
| --- | --- |
| `src/scripts/lib/findShopId.mjs` | 이벤트가 열리는 샵을 찾아 `events.shop_id` 채우기 (후보 1곳일 때만) |
| `src/scripts/lib/seriesKey.mjs` | 지점만 다른 같은 이벤트를 `events.series_key`로 묶기 |

## 참고 — 앱에서의 동작

- **이벤트 홈 / 전체 보기**: 같은 `series_key`는 카드 한 장으로 접히고 `N개 지점` 배지가 붙는다.
  접기는 정렬(`rankEvents`) **뒤에** 하므로, 대표 카드는 가장 임박한 지점이고
  지역 필터가 걸려 있으면 그 지역 지점이 대표가 된다.
- **이벤트 상세**: 하단에 "다른 지점" 섹션이 생기고, "작품의 다른 이벤트"에서는 같은 묶음이 빠진다.
- **이벤트 등록 위저드 3단계**: 제목·기간이 완전히 같은 이벤트를 찾아
  "같은 이벤트가 이미 등록돼 있어요 → [네, 같은 이벤트예요]"를 띄운다.
  사람이 손으로 등록할 때는 이 경로로 묶인다.
- **이벤트 캘린더**: 일부러 접지 않는다. 날짜별로 어느 지점이 언제 하는지 보이는 게 맞기 때문.

## 참고 — 관련 마이그레이션

| 파일 | 내용 |
| --- | --- |
| `migrations/event_series_key.sql` | `events.series_key` 컬럼 + 부분 인덱스 |
| `migrations/event_link_series.sql` | `link_event_series()` RPC — 위저드에서 남의 이벤트와 묶을 때 사용 |
