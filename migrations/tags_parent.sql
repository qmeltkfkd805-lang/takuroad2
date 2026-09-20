-- 작품 계층 (프랜차이즈) — 2026-09-20
--
-- 샵 등록/수정의 "취급 작품" 검색이 이름만 보고 있어서, "디즈니" 를 쳐도
-- 릴로&스티치·겨울왕국 같은 하위 작품이 안 나왔다.
-- tags.parent_tag_id 로 프랜차이즈 부모를 두고, 검색이 부모 이름까지 훑게 한다.
--
-- 평면 1단이다. 픽사 작품도 픽사가 아니라 디즈니 직속으로 둔다 —
-- 검색이 1단계라 2단으로 두면 "디즈니" 에 손자가 안 나오기 때문이다.
-- 나중에 재귀로 바꾸면 그때 구조만 조정하면 된다.

alter table public.tags
  add column if not exists parent_tag_id uuid references public.tags(id) on delete set null;

alter table public.tags drop constraint if exists tags_parent_not_self;
alter table public.tags add constraint tags_parent_not_self
  check (parent_tag_id is null or parent_tag_id <> id);

create index if not exists idx_tags_parent on public.tags(parent_tag_id)
  where parent_tag_id is not null;

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

-- ── 보컬로이드 (39) ── ip_type 기준이라 신규 보컬로이드도 조건만 맞으면 포함된다
update public.tags
   set parent_tag_id = (select id from public.tags where slug = 'vocaloid')
 where ip_type like '%보컬로이드%' and slug <> 'vocaloid';

-- ── 산리오 (10) ──
update public.tags
   set parent_tag_id = (select id from public.tags where slug = 'sanrio')
 where slug in ('hello-kitty','kuromi','cinnamoroll','my-melody','pompompurin',
                'pochacco','keroppi','hangyodon','badtz-maru','wish-me-mell');

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

-- 확인 쿼리
-- select p.name as 부모, count(*) as 자식수
--   from public.tags t join public.tags p on p.id = t.parent_tag_id
--  group by p.name order by 자식수 desc;
-- 기대: 보컬로이드 39 / 디즈니 18 / 산리오 10 / 스튜디오 지브리 8 / 건담 7  (합 82)