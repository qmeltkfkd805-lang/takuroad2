-- ============================================================
-- 회원 탈퇴 — 진짜 삭제 + 글·후기·루트는 '탈퇴한 회원'으로 남김 (2026-10-12)
--
-- 방식
--   · 로그인 계정(auth.users)은 서버(/api/account/delete)가 진짜로 지운다
--     → 같은 카카오·구글 계정으로 다시 가입하면 새 회원이 된다.
--   · profiles 행은 지우지 않고 '탈퇴한회원_xxxxxxxx' 껍데기로 남긴다
--     → 커뮤니티 글·댓글·이벤트 후기·Q&A·루트·루트 후기가 그 껍데기를 가리켜서
--       다른 사람 댓글이 달린 글, 남이 저장한 루트가 깨지지 않는다.
--   · 개인 기록(방문·경험치·배지·찜·좋아요·투표·알림·굿즈 보관함 등)은 진짜로 지운다.
--
-- 이 SQL이 하는 일
--   A. profiles.id → auth.users 외래키 제거
--      (안 그러면 auth 계정을 지우는 순간 profiles 가 같이 지워지고,
--       profiles 를 가리키는 글·댓글·후기·루트까지 CASCADE 로 전부 사라진다)
--   B. 남길 콘텐츠 중 auth.users 를 직접 가리키던 것 → profiles 를 가리키게
--        route_reviews · route_review_photos · event_visit_photos  (on delete cascade)
--        contact_messages.user_id  (on delete set null — 문의 내역은 남김.
--        지금은 NO ACTION 이라 문의한 적 있는 회원은 탈퇴 자체가 막힌다)
--   C. delete_account_data(uid) — 개인 기록 삭제 + 프로필 익명화 (service_role 전용)
--
-- 순서: 이 SQL 먼저 → 그다음 코드 배포. (SQL 없이 새 코드만 있으면 탈퇴 버튼이
--       'delete_account_data 없음' 으로 실패할 뿐 데이터는 안 건드린다)
-- ============================================================

begin;

-- ── A) profiles → auth.users 외래키 제거 ──
alter table public.profiles drop constraint if exists profiles_id_fkey;

-- ── B) 남길 콘텐츠의 외래키를 profiles 로 ──
do $repoint$
declare
  r record;
begin
  for r in
    select c.conname, c.conrelid::regclass as tbl, a.attname as col
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
     where c.contype = 'f'
       and c.confrelid = 'auth.users'::regclass
       and (c.conrelid, a.attname::text) in (
             ('public.route_reviews'::regclass,       'user_id'),
             ('public.route_review_photos'::regclass, 'user_id'),
             ('public.event_visit_photos'::regclass,  'user_id'),
             ('public.contact_messages'::regclass,    'user_id'))
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    if r.tbl = 'public.contact_messages'::regclass then
      execute format('alter table %s add constraint %I foreign key (%I) references public.profiles(id) on delete set null',
                     r.tbl, r.conname, r.col);
    else
      execute format('alter table %s add constraint %I foreign key (%I) references public.profiles(id) on delete cascade',
                     r.tbl, r.conname, r.col);
    end if;
  end loop;
end
$repoint$;

-- ── C) 개인 기록 삭제 + 프로필 익명화 ──
create or replace function public.delete_account_data(p_uid uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $del_acct$
declare
  v_role text;
begin
  select role into v_role from public.profiles where id = p_uid;
  if not found then
    return;                                   -- 이미 없음 — 멱등
  end if;
  if v_role = 'admin' then
    raise exception '관리자 계정은 탈퇴할 수 없습니다' using errcode = '42501';
  end if;

  -- 개인 기록 (profiles 를 가리키지만 profiles 를 안 지우므로 직접 지운다)
  delete from public.saved_shops            where user_id = p_uid;
  delete from public.shop_verify_requests   where user_id = p_uid;
  delete from public.notifications          where user_id = p_uid;
  delete from public.check_ins              where user_id = p_uid;
  delete from public.user_exp               where user_id = p_uid;
  delete from public.exp_logs               where user_id = p_uid;
  delete from public.activity_logs          where user_id = p_uid;
  delete from public.user_badge_tiers       where user_id = p_uid;
  delete from public.route_progress         where user_id = p_uid;
  delete from public.route_completions      where user_id = p_uid;
  delete from public.route_starts           where user_id = p_uid;
  delete from public.shop_suggestion_votes  where user_id = p_uid;
  delete from public.shop_info_confirmations where user_id = p_uid;
  delete from public.user_tag_collections   where user_id = p_uid;
  delete from public.user_favorite_tags     where user_id = p_uid;
  delete from public.user_library           where user_id = p_uid;
  delete from public.fan_art_likes          where user_id = p_uid;
  delete from public.post_likes             where user_id = p_uid;
  delete from public.poll_votes             where user_id = p_uid;
  delete from public.comment_likes          where user_id = p_uid;
  delete from public.goods_items            where owner_id = p_uid;
  delete from public.goods_collection_covers where owner_id = p_uid;
  delete from public.work_requests          where user_id = p_uid;
  delete from public.post_appeals           where author_id = p_uid;

  -- 검색 기록은 누구 것인지만 끊는다(통계는 유지)
  update public.search_logs set user_id = null where user_id = p_uid;

  -- 사장님 인증 매장 → 인증 해제(매장 정보는 사이트 자산이라 남김)
  update public.shops set is_claimed = false, owner_id = null
   where owner_id = p_uid and is_claimed is true;
  update public.shops set owner_id = null where owner_id = p_uid;
  -- 등록 요청 중이던 샵은 요청 목록에서 뺀다(공개된 샵의 added_by 는 '탈퇴한 회원'으로 남음)
  update public.shops set status = 'hidden' where added_by = p_uid and status = 'pending';

  -- 프로필 → 껍데기. 닉네임은 unique 라 id 앞 8자리를 붙인다(원래 닉네임은 다시 쓸 수 있게 풀림)
  update public.profiles
     set nickname              = '탈퇴한회원_' || left(replace(p_uid::text, '-', ''), 8),
         avatar_url            = null,
         bio                   = null,
         is_profile_public     = false,
         selected_title_id     = null,
         equipped              = '{}'::jsonb,
         privacy_settings      = null,
         notification_settings = null,
         app_settings          = null,
         admin_note            = null,
         status                = 'deleted',
         suspended_until       = null,
         signup_channel = null, signup_referrer = null, signup_landing_path = null,
         signup_utm_source = null, signup_utm_medium = null, signup_utm_campaign = null,
         marketing_agreed_at   = null
   where id = p_uid;
end;
$del_acct$;

revoke all on function public.delete_account_data(uuid) from public, anon, authenticated;
grant execute on function public.delete_account_data(uuid) to service_role;

commit;

select pg_notify('pgrst', 'reload schema');

-- ============================================================
-- [확인] 
-- 1) profiles_id_fkey 가 없어야 한다 → 0행
-- select conname from pg_constraint where conname = 'profiles_id_fkey';
--
-- 2) 네 테이블의 user_id 가 이제 profiles 를 가리킨다 → 4행, 참조 = profiles
-- select c.conrelid::regclass, c.confrelid::regclass, c.confdeltype
--   from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attnum=any(c.conkey)
--  where c.contype='f' and a.attname='user_id'
--    and c.conrelid in ('public.route_reviews'::regclass,'public.route_review_photos'::regclass,
--                       'public.event_visit_photos'::regclass,'public.contact_messages'::regclass);
--
-- 3) 함수가 일반 사용자에게 안 열려 있다 → authenticated 없음
-- select grantee from information_schema.routine_privileges where routine_name='delete_account_data';
-- ============================================================
