-- 작품 계층 (프랜차이즈) — 2026-09-20
--
-- 샵 등록/수정의 "취급 작품" 검색이 이름만 보고 있어서 "디즈니" 를 쳐도
-- 릴로&스티치·겨울왕국 같은 하위 작품이 안 나왔다.
-- tags.parent_tag_id 로 프랜차이즈 부모를 두고, 검색이 부모 이름까지 훑게 한다.
--
-- 평면 1단이다. 픽사 작품도 픽사가 아니라 디즈니 직속으로 둔다 —
-- 검색이 1단계라 2단으로 두면 "디즈니" 에 손자가 안 나오기 때문이다.
--
-- 자식 선정은 자동 탐지로 시작했으나 이름 부분일치만으로는 놓친다.
-- (치이카와의 하치와레·우사기처럼 이름에 부모명이 안 들어가는 경우)
-- 최종 목록은 ip_type 에 캐릭터가 든 미배정 태그를 전수 검토해서 정했다.

alter table public.tags
  add column if not exists parent_tag_id uuid references public.tags(id) on delete set null;

alter table public.tags drop constraint if exists tags_parent_not_self;
alter table public.tags add constraint tags_parent_not_self
  check (parent_tag_id is null or parent_tag_id <> id);

create index if not exists idx_tags_parent on public.tags(parent_tag_id)
  where parent_tag_id is not null;

-- 이름 정정: 치이카와의 ラッコ. slug 는 /work/rako 링크 보존을 위해 그대로 둔다.
update public.tags set name = '랏코' where slug = 'rako';

-- ── 디즈니 (18) ──
update public.tags
   set parent_tag_id = (select id from public.tags where slug = 'disney')
 where slug in (
   'frozen','winnie-the-pooh','tangled','lilo-and-stitch','moana',
   'monsters-inc','mickey-mouse','inside-out','zootopia','coco',
   'toy-story','disney-twisted-wonderland','pixar','marvel','star-wars',
   -- 마블 애니는 마블이 아니라 디즈니 직속. 마블 밑에 두면 "디즈니" 검색에 안 나온다.
   'marvel-future-avengers-anime','marvel-anime-blade','marvel-anime-iron-man'
 );

-- ── 보컬로이드 (40) ── ip_type 기준 + 카사네 테토(UTAU, 관례상 함께 묶음)
update public.tags
   set parent_tag_id = (select id from public.tags where slug = 'vocaloid')
 where (ip_type like '%보컬로이드%' or slug = 'kasane-teto') and slug <> 'vocaloid';

-- ── 산리오 (18) ──
update public.tags
   set parent_tag_id = (select id from public.tags where slug = 'sanrio')
 where slug in ('hello-kitty','kuromi','cinnamoroll','my-melody','pompompurin',
                'pochacco','keroppi','hangyodon','badtz-maru','wish-me-mell',
                'lala-sanrio','kiki-sanrio','little-twin-stars','usahana',
                'marumofubiyori','sugarbunnies','cogimyun','tuxedosam');

-- ── 건담 (7) ──
update public.tags
   set parent_tag_id = (select id from public.tags where slug = 'gundam')
 where slug in ('mobile-suit-gundam','mobile-suit-z-gundam','mobile-suit-gundam-zz',
                'mobile-suit-gundam-00','mobile-suit-gundam-seed',
                'mobile-suit-gundam-the-witch-from-mercury',
                'mobile-suit-gundam-iron-blooded-orphans');

-- ── 스튜디오 지브리 (8) ──
-- "모노노케"(2007년 별개 애니)·"불쾌한 모노노케안" 은 지브리가 아니므로 제외했다.
update public.tags
   set parent_tag_id = (select id from public.tags where slug = 'studio-ghibli')
 where slug in ('my-neighbor-totoro','spirited-away','howls-moving-castle',
                'castle-in-the-sky','ponyo','kikis-delivery-service',
                'whisper-of-the-heart','princess-mononoke');

-- ── 치이카와 (6) ──
-- "오빤쥬 토끼"(opanchu-usagi) 는 이름이 비슷하지만 별개 작가 작품이라 제외.
update public.tags
   set parent_tag_id = (select id from public.tags where slug = 'chiikawa')
 where slug in ('usagi-chiikawa','hachiware','momonga','kurimanju','shisa','rako');

-- ── 라인프렌즈 (1) ──
update public.tags
   set parent_tag_id = (select id from public.tags where slug = 'line-friends')
 where slug = 'bt21';

-- 확인 쿼리
-- select p.name as 부모, count(*) as 자식수
--   from public.tags t join public.tags p on p.id = t.parent_tag_id
--  group by p.name order by 자식수 desc;
-- 기대: 보컬로이드 40 / 디즈니 18 / 산리오 18 / 지브리 8 / 건담 7 / 치이카와 6 / 라인프렌즈 1
--       합 98

-- 미결: 쥬얼펫(산리오·세가토이즈 공동), 프로젝트 세카이(미쿠 게임) — 부모 미지정
-- 미검토: 프리큐어·울트라맨·전대 시리즈 하위 시리즈(ip_type 에 캐릭터가 없어 이번 조사에서 빠짐),
--         닌텐도 부모 태그 부재(슈퍼마리오·별의 커비·피크민·스플래툰·동물의 숲)