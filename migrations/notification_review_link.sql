-- ============================================================
-- 후기 알림을 눌렀을 때 해당 후기로 이동
--
-- 문제: notify_shop_owner_review 가 link 에 '/shop/{slug}' 만 넣어서, 알림을
--       눌러도 샵 페이지 맨 위로만 갔다. 후기 id 는 related_id 에 이미 있었지만
--       링크에는 반영되지 않았다.
--
-- ✅ 사전 확인 (2026-09-03) — 딥링크는 이미 구현돼 있었다. 새로 만들 게 없다.
--   ShopDetailPageDesktop.tsx:200
--     useEffect(() => { if (sp.get('review') || sp.get('comment')) setTab('reviews') })
--     → ?review= 가 있으면 리뷰 탭을 자동으로 연다.
--       데스크톱은 리뷰 탭이 아닐 때 ReviewSection 자체가 렌더되지 않으므로
--       해시(#review-)만으로는 동작하지 않는다. 쿼리 파라미터여야 한다.
--   ReviewSection.tsx:258~273
--     const targetReview = sp.get('review')
--     → 해당 후기를 강조하고 스크롤한다.
--   모바일(ShopDetailPage)은 ReviewSection 을 항상 렌더하고 같은 값을 읽는다.
--   마이페이지 '내 댓글'(MyCommentsTab)이 이미 같은 형식을 쓰고 있다.
--
--   → 링크 형식: /shop/{slug}?review={review_id}
--
-- ⚠️ create or replace function 은 security / set search_path 까지 통째로 새로
--    쓴다. 빠뜨리면 security invoker 로 돌아가고, notifications INSERT 권한이
--    회수된 상태(notifications_write_privileges.sql)라 알림이 실패하면서
--    **후기 작성 자체가 롤백된다.** 아래 정의에 둘 다 포함돼 있다.
--
--    바꾼 것은 link 표현식 한 줄뿐이다. 차단 확인(are_blocked), 본인 후기 제외,
--    사장님 없는 샵 건너뛰기는 원본 그대로다.
-- ============================================================

create or replace function public.notify_shop_owner_review()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $fn$
declare v_owner_id uuid; v_shop_name text; v_shop_slug text; v_reviewer_nickname text;
begin
  select owner_id, name, slug into v_owner_id, v_shop_name, v_shop_slug from shops where id = new.shop_id;
  if v_owner_id is null or v_owner_id = new.user_id then return new; end if;
  if public.are_blocked(new.user_id, v_owner_id) then return new; end if;
  select nickname into v_reviewer_nickname from profiles where id = new.user_id;
  insert into notifications (user_id, type, title, body, link, related_type, related_id)
  values (v_owner_id, 'shop_review', '내 샵에 새 후기가 달렸어요',
    coalesce(v_reviewer_nickname,'누군가') || '님이 ' || coalesce(v_shop_name,'샵') || '에 리뷰를 남겼어요',
    '/shop/' || v_shop_slug || '?review=' || new.id, 'review', new.id);
  return new;
end
$fn$;


-- 이미 쌓인 알림에도 링크를 붙인다. 여러 번 돌려도 안전하다(not like 조건).
update public.notifications
   set link = link || '?review=' || related_id::text
 where type = 'shop_review'
   and related_type = 'review'
   and related_id is not null
   and link is not null
   and link not like '%?review=%';


select pg_notify('pgrst', 'reload schema');


-- ============================================================
-- [적용 후 검증]
-- ============================================================
-- select prosecdef, proconfig from pg_proc
-- where pronamespace='public'::regnamespace and proname='notify_shop_owner_review';
-- -- 기대: prosecdef = true, proconfig 에 search_path 가 있을 것
--
-- select link from public.notifications where type='shop_review' order by created_at desc limit 5;
-- -- 기대: /shop/{slug}?review={uuid}


-- ============================================================
-- [회귀 테스트]
--   1. 후기 작성 → 저장되고 사장님에게 알림이 오는지 (여기가 먼저 확인돼야 한다)
--   2. 그 알림 클릭 → 데스크톱이면 리뷰 탭이 열리고 해당 후기가 강조되는지
--   3. 모바일이면 해당 후기로 스크롤되는지
--   4. 본인이 자기 샵에 후기를 쓰면 알림이 안 가는지 (기존 동작 유지)


-- ============================================================
-- [후속 과제]
-- 후기 댓글 알림 둘도 같은 처리가 필요하다. 지금은 어디로 보내는지 확인하지 않았다.
--   notify_review_comment       후기 댓글 → 후기 작성자에게
--   notify_shop_owner_comment   후기 댓글 → 샵 사장님에게
-- ReviewSection 은 ?comment= 도 읽으므로(MyCommentsTab 이 쓰는 형식)
--   /shop/{slug}?review={review_id}&comment={comment_id}
-- 형태로 보내면 그 댓글까지 짚어줄 수 있다.
--
-- v_shop_slug 가 null 이면 link 전체가 null 이 된다(|| 의 null 전파).
-- 원본부터 그랬고 shops.slug 는 실질적으로 항상 차 있어 이번에는 두었다.
-- ============================================================
