-- ============================================================
-- 후기 댓글 알림을 눌렀을 때 그 댓글로 이동
--
-- notification_review_link.sql 의 후속. 후기 알림은 고쳤고 댓글 알림 둘이 남아 있었다.
--
-- 문제:
--   notify_review_comment      link = '/shop/{slug}#review-{review_id}'
--     → 해시는 데스크톱에서 동작하지 않는다. ShopDetailPageDesktop 은 리뷰 탭이
--       아닐 때 ReviewSection 을 아예 렌더하지 않으므로, 해시를 읽을 코드가 없다.
--       모바일에서만 우연히 동작했다.
--   notify_shop_owner_comment  link = '/shop/{slug}'
--     → 샵 페이지 맨 위로만 간다. 어떤 댓글인지 알 수 없다.
--
-- ✅ 사전 확인 (2026-09-03) — 딥링크는 이미 구현돼 있다. 새로 만들 게 없다.
--   ShopDetailPageDesktop.tsx:200
--     ?review= 또는 ?comment= 가 있으면 리뷰 탭을 자동으로 연다.
--   ReviewSection.tsx:263~272
--     targetReview 가 이 후기면 loadComments() + setShowComments(true) + 스크롤·강조.
--   ReviewSection.tsx:283~288
--     댓글이 로드된 뒤 targetComment 를 찾아 'comment-<id>' 로 스크롤.
--   → 둘을 같이 붙여야 한다. ?review= 가 댓글 영역을 펼치고,
--     ?comment= 이 그 안에서 해당 댓글로 내려간다.
--   마이페이지 '내 댓글'(MyCommentsTab)이 이미 같은 형식을 쓴다.
--
--   → 링크 형식: /shop/{slug}?review={review_id}&comment={comment_id}
--
-- ⚠️ create or replace function 은 security / set search_path 까지 통째로 새로 쓴다.
--    빠뜨리면 security invoker 로 돌아가고, notifications 의 INSERT 권한이 회수된
--    상태(notifications_write_privileges.sql)라 알림이 실패하면서
--    **후기 댓글 작성 자체가 롤백된다.** 아래 정의에 둘 다 포함돼 있다.
--
--    바꾼 것은 각 함수의 link 표현식 한 줄뿐이다. 차단 확인(are_blocked),
--    본인 댓글 제외, 사장님/작성자 없는 경우 건너뛰기는 원본 그대로다.
-- ============================================================


-- ── 후기 작성자에게 가는 알림 ───────────────────────────────
create or replace function public.notify_review_comment()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $fn$
declare v_review_user_id uuid; v_shop_name text; v_shop_slug text; v_commenter_nickname text;
begin
  select user_id into v_review_user_id from reviews where id = new.review_id;
  if v_review_user_id is null or v_review_user_id = new.user_id then return new; end if;
  if public.are_blocked(new.user_id, v_review_user_id) then return new; end if;
  select s.name, s.slug into v_shop_name, v_shop_slug
    from reviews r join shops s on s.id = r.shop_id where r.id = new.review_id;
  select nickname into v_commenter_nickname from profiles where id = new.user_id;
  insert into notifications (user_id, type, title, body, link, related_type, related_id)
  values (v_review_user_id, 'review_comment', '내 후기에 댓글이 달렸어요',
    coalesce(v_commenter_nickname,'누군가') || '님이 ' || coalesce(v_shop_name,'샵') || ' 리뷰에 댓글을 남겼어요',
    '/shop/' || v_shop_slug || '?review=' || new.review_id || '&comment=' || new.id,
    'review_comment', new.id);
  return new;
end
$fn$;


-- ── 샵 사장님에게 가는 알림 ─────────────────────────────────
create or replace function public.notify_shop_owner_comment()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $fn$
declare v_owner_id uuid; v_shop_name text; v_shop_slug text; v_commenter_nickname text;
begin
  select s.owner_id, s.name, s.slug into v_owner_id, v_shop_name, v_shop_slug
    from reviews r join shops s on s.id = r.shop_id where r.id = new.review_id;
  if v_owner_id is null or v_owner_id = new.user_id then return new; end if;
  if public.are_blocked(new.user_id, v_owner_id) then return new; end if;
  select nickname into v_commenter_nickname from profiles where id = new.user_id;
  insert into notifications (user_id, type, title, body, link, related_type, related_id)
  values (v_owner_id, 'shop_comment', '내 샵 후기에 댓글이 달렸어요',
    coalesce(v_commenter_nickname,'누군가') || '님이 ' || coalesce(v_shop_name,'샵') || ' 리뷰에 댓글을 남겼어요',
    '/shop/' || v_shop_slug || '?review=' || new.review_id || '&comment=' || new.id,
    'review_comment', new.id);
  return new;
end
$fn$;


-- ── 이미 쌓인 알림 backfill ─────────────────────────────────
-- 두 알림 모두 related_type='review_comment', related_id=댓글 id 다.
-- 댓글 → 후기 → 샵 을 타고 올라가면 필요한 값이 다 나온다.
-- 여러 번 돌려도 안전하다(not like 조건).
update public.notifications n
   set link = '/shop/' || s.slug || '?review=' || rc.review_id::text || '&comment=' || rc.id::text
  from public.review_comments rc
  join public.reviews r on r.id = rc.review_id
  join public.shops   s on s.id = r.shop_id
 where n.related_type = 'review_comment'
   and n.related_id   = rc.id
   and s.slug is not null
   and n.link is not null
   and n.link not like '%?review=%';


select pg_notify('pgrst', 'reload schema');


-- ============================================================
-- [적용 후 검증]
-- ============================================================
-- select proname, prosecdef, proconfig
-- from pg_proc
-- where pronamespace='public'::regnamespace
--   and proname in ('notify_review_comment','notify_shop_owner_comment')
-- order by proname;
-- -- 기대: prosecdef = true, proconfig 에 search_path 가 있을 것
--
-- select type, link from public.notifications
-- where related_type = 'review_comment' order by created_at desc limit 5;
-- -- 기대: /shop/{slug}?review={uuid}&comment={uuid}


-- ============================================================
-- [회귀 테스트]
--   1. 후기에 댓글 작성 → **댓글이 저장되는지** (여기가 먼저다.
--      트리거가 터지면 원래 INSERT 까지 롤백돼서 댓글이 안 달린다)
--   2. 후기 작성자 계정에 알림이 오는지
--   3. 샵 사장님 계정에도 알림이 오는지
--   4. 그 알림 클릭 → 데스크톱: 리뷰 탭이 열리고 해당 후기가 강조된 뒤
--      댓글 영역이 펼쳐지며 그 댓글로 스크롤되는지
--   5. 모바일: 같은 동작
--   6. 자기 후기에 자기가 댓글 → 알림이 안 가는지 (기존 동작 유지)


-- ============================================================
-- [롤백]
-- ============================================================
-- 링크만 바꾼 것이라 되돌릴 이유는 없다. 굳이 되돌리려면 각 함수의
-- link 표현식을 아래로 바꿔 다시 create or replace 한다
-- (security definer / set search_path 는 반드시 유지할 것).
--   notify_review_comment      '/shop/' || v_shop_slug || '#review-' || new.review_id
--   notify_shop_owner_comment  '/shop/' || v_shop_slug


-- ============================================================
-- [후속 과제]
-- - v_shop_slug 가 null 이면 || 의 null 전파로 link 전체가 null 이 된다.
--   원본부터 그랬고 shops.slug 는 실질적으로 항상 차 있어 이번에도 두었다.
-- - 알림 link 를 만드는 곳이 트리거 함수마다 흩어져 있다. 형식이 바뀌면
--   여기저기 고쳐야 한다. 링크 조립 함수 하나로 모으는 것을 고려할 만하다.
-- ============================================================
