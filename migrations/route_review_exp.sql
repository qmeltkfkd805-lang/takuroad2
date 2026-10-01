-- 루트 완주 경험치(15) — GPS 자동 확인을 뺐으므로, 완주 후기에 글 + 사진 3장을 남긴 사람에게 준다
-- Supabase SQL Editor 에서 한 번 실행하세요. 여러 번 실행해도 안전합니다.
--
--   · 후기는 완주한 사람만 쓸 수 있다 (route_reviews 정책). 그래서 '후기 + 사진 3장' = 완주 인증으로 본다.
--   · 루트당 한 번만 — grant_exp 의 once 키(사람, route_completed, 루트 id). 예전 GPS 완주로 이미 받은 루트도 다시 안 준다.
--   · 사진을 지웠다 다시 올려도, 글을 고쳐도 중복 지급 없음.

create or replace function public.route_review_exp_check(p_review_id uuid)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'pg_temp'
as $$
declare
  v_route uuid;
  v_user  uuid;
  v_text  text;
  v_photos int;
begin
  select rv.route_id, rv.user_id, rv.content into v_route, v_user, v_text
  from public.route_reviews rv where rv.id = p_review_id;
  if v_route is null then return; end if;
  if length(btrim(coalesce(v_text, ''))) = 0 then return; end if;

  select count(*) into v_photos from public.route_review_photos where review_id = p_review_id;
  if v_photos < 3 then return; end if;

  -- 완주 기록이 있어야 한다 (후기 정책과 같은 조건 — 안전장치)
  if not exists (select 1 from public.route_completions c where c.route_id = v_route and c.user_id = v_user) then
    return;
  end if;

  perform public.grant_exp(v_user, 15, 'route_completed', 'route', v_route, true, null);
end;
$$;

revoke all on function public.route_review_exp_check(uuid) from public, anon, authenticated;

-- 사진이 추가될 때
create or replace function public.trg_route_review_photo_exp()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'pg_temp'
as $$
begin
  perform public.route_review_exp_check(new.review_id);
  return null;
end;
$$;

drop trigger if exists route_review_photo_exp on public.route_review_photos;
create trigger route_review_photo_exp
  after insert on public.route_review_photos
  for each row execute function public.trg_route_review_photo_exp();

-- 사진 3장을 먼저 올리고 글을 나중에 쓴 경우
create or replace function public.trg_route_review_text_exp()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'pg_temp'
as $$
begin
  if coalesce(new.content, '') is distinct from coalesce(old.content, '') then
    perform public.route_review_exp_check(new.id);
  end if;
  return null;
end;
$$;

drop trigger if exists route_review_text_exp on public.route_reviews;
create trigger route_review_text_exp
  after update of content on public.route_reviews
  for each row execute function public.trg_route_review_text_exp();

-- 확인용: 트리거 2개
select tgname from pg_trigger
where tgname in ('route_review_photo_exp', 'route_review_text_exp') and not tgisinternal;
