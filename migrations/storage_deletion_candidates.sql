-- ############################################################
-- 폐기됨 (2026-09-23). 적용했다가 같은 날 제거했다.
--
-- 참조 컬럼 목록을 여기 따로 둔 것이 잘못이었다. 같은 목록이 이미
-- src/lib/storage/canonicalRef.ts 의 REF_SOURCES 에 있었고 둘이 어긋났다.
-- 대체본과 어긋난 내역은 migrations/storage_orphan_detection_v2.sql 참고.
--
-- 이 파일은 되돌릴 일이 있을 때를 위한 기록으로만 남긴다. 실행하지 말 것.
-- ############################################################

-- ============================================================
-- Storage 삭제 후보 탐지 — 읽기 전용
--
-- 삭제 기능은 만들지 않는다. 참조 컬럼이 하나 늘 때마다 자동 삭제는 위험해진다.
-- (조사 중 goods_item_images 를 빠뜨려 굿즈 사진 6장을 지울 뻔했다)
--
-- 구성
--   1. storage_reference_values  뷰 — 참조 출처 목록. 여기 한 곳만 고치면 된다
--   2. storage_reference_pairs   뷰 — {bucket, path} 정규화 + 파싱 상태
--   3. storage_deletion_candidates() 함수 — jsonb 보고서
--
-- 설계 원칙
--   · 파싱 실패가 하나라도 있으면 건수를 내지 않고 '검사 불완전' 로 표시한다.
--     0건과 검사 불완전은 다른 상태다.
--   · 업로드 직후 아직 DB 에 연결되지 않은 객체가 있으므로,
--     최근 생성 객체는 '판정 보류' 로 따로 묶는다 (기본 24시간, 인자로 조정).
--   · verify-documents 는 건수와 용량만 낸다. 경로를 응답에 싣지 않는다.
--   · service_role 전용. 브라우저에 EXECUTE 를 주지 않는다.
-- ============================================================


-- ============================================================
-- 1. 참조 출처 목록
-- ============================================================
--   ⚠️ 새 업로드 경로가 생기면 여기에 추가해야 한다. 안 그러면 그 파일이
--      삭제 후보로 잘못 잡힌다. 이 뷰가 유일한 정의 지점이다.
--
--   kind = 'url'  전체 URL 을 저장하는 컬럼 (버킷을 URL 에서 파싱한다)
--   kind = 'path' 경로만 저장하는 컬럼 (버킷을 컬럼값이나 상수로 안다)
--
--   [검토했으나 제외한 컬럼 — 실제 값을 확인한 결과 스토리지와 무관]
--     외부 링크   shops.{blog,instagram,kakao_channel,twitter,website}_url
--                tags.{homepage,official,twitter,youtube}_url  (official_url 1,711건 전부 외부)
--                events.{source_urls,ticket_urls}             (source_urls 701건 전부 외부)
--                event_submissions.{source_url,source_urls,ticket_urls}
--                post_appeals.original_url, work_requests.ref_url,
--                contact_messages.page_url
--     내부 라우트 visit_logs.path (10,194건, '/' 등), profiles.signup_landing_path
--     이모지      categories.icon(☕), goods_types.icon(✏️), shop_amenities.icon(♻️)
--     열거값      shop_product_images.image_type
create or replace view public.storage_reference_values as
          select 'shop_images.image_url'              as src, 'url'::text as kind, null::text as bucket, image_url        as val from public.shop_images            where image_url        is not null
union all select 'shop_events.image_url',                     'url', null,            image_url             from public.shop_events            where image_url        is not null
union all select 'shop_events.video_url',                     'url', null,            video_url             from public.shop_events            where video_url        is not null
union all select 'shop_highlights.image_url',                 'url', null,            image_url             from public.shop_highlights        where image_url        is not null
union all select 'notices.image_url',                         'url', null,            image_url             from public.notices                where image_url        is not null
union all select 'featured_banners.image_url',                'url', null,            image_url             from public.featured_banners       where image_url        is not null
union all select 'home_hero_slots.custom_image_url',          'url', null,            custom_image_url      from public.home_hero_slots        where custom_image_url is not null
union all select 'tags.cover_url',                            'url', null,            cover_url             from public.tags                   where cover_url        is not null
union all select 'tags.banner_image',                         'url', null,            banner_image          from public.tags                   where banner_image     is not null
union all select 'routes.cover_image_url',                    'url', null,            cover_image_url       from public.routes                 where cover_image_url  is not null
union all select 'profiles.avatar_url',                       'url', null,            avatar_url            from public.profiles               where avatar_url       is not null
union all select 'shop_product_images.image_url',             'url', null,            image_url             from public.shop_product_images    where image_url        is not null
union all select 'shop_suggestions.image_url',                'url', null,            image_url             from public.shop_suggestions       where image_url        is not null
union all select 'fan_arts.image_url',                        'url', null,            image_url             from public.fan_arts               where image_url        is not null
union all select 'seasonal_events.cover_image_url',           'url', null,            cover_image_url       from public.seasonal_events        where cover_image_url  is not null
union all select 'events.cover_url',                          'url', null,            cover_url             from public.events                 where cover_url        is not null
union all select 'events.video_url',                          'url', null,            video_url             from public.events                 where video_url        is not null
union all select 'event_goods.image_url',                     'url', null,            image_url             from public.event_goods            where image_url        is not null
union all select 'event_goods_history.image_url',             'url', null,            image_url             from public.event_goods_history    where image_url        is not null
union all select 'places.cover_image',                        'url', null,            cover_image           from public.places                 where cover_image      is not null
union all select 'places.cover_url',                          'url', null,            cover_url             from public.places                 where cover_url        is not null
union all select 'review_images.image_url',                   'url', null,            image_url             from public.review_images          where image_url        is not null
union all select 'goods_item_images.external_url',            'url', null,            external_url          from public.goods_item_images      where external_url     is not null
-- 아이콘·자산 계열: 대부분 '/badges/…' 같은 /public 정적 파일이지만
-- badges.icon_url 27건 중 3건이 실제 스토리지 URL 이다. 정적 파일은 local_asset 로 분류된다.
union all select 'badges.icon_url',                           'url', null,            icon_url              from public.badges                 where icon_url         is not null
union all select 'badge_tiers.icon_url',                      'url', null,            icon_url              from public.badge_tiers            where icon_url         is not null
union all select 'badge_groups.icon',                         'url', null,            icon                  from public.badge_groups           where icon             is not null
union all select 'cosmetics.asset_url',                       'url', null,            asset_url             from public.cosmetics              where asset_url        is not null
union all select 'cosmetics.preview_url',                     'url', null,            preview_url           from public.cosmetics              where preview_url      is not null
union all select 'community_posts.images',                    'url', null,            jsonb_array_elements_text(images)       from public.community_posts  where jsonb_typeof(images) = 'array'
union all select 'post_appeals.proof_images',                 'url', null,            jsonb_array_elements_text(proof_images) from public.post_appeals     where jsonb_typeof(proof_images) = 'array'
union all select 'contact_messages.attachment_urls',          'url', null,            unnest(attachment_urls)                 from public.contact_messages where attachment_urls  is not null
-- 경로만 저장하는 컬럼
-- shop_images.storage_path: image_url 과 항상 쌍이지만(path 단독 0건) 안전장치로 넣는다.
-- 141건 전부 shop-images 버킷에서 확인됨.
union all select 'shop_images.storage_path',                  'path', 'shop-images',      storage_path from public.shop_images                   where storage_path is not null
union all select 'shop_verify_requests.evidence_url',         'path', 'verify-documents', evidence_url from public.shop_verify_requests          where evidence_url is not null
union all select 'goods_item_images.object_path',             'path', bucket_name,        object_path  from public.goods_item_images             where object_path is not null and bucket_name is not null
union all select 'exhibit_images.object_path',                'path', 'exhibit-images',   object_path  from public.exhibit_images                where object_path is not null
union all select 'exhibit_storage_cleanup_queue.object_path', 'path', bucket_id,          object_path  from public.exhibit_storage_cleanup_queue where object_path is not null;

comment on view public.storage_reference_values is
  'Storage 객체를 참조하는 모든 컬럼의 원본 값. 새 업로드 경로가 생기면 여기에 추가할 것.';


-- ============================================================
-- 2. {bucket, path} 정규화 + 파싱 상태
-- ============================================================
--   parsed       Supabase Storage URL 또는 버킷이 명시된 경로 → 대조에 쓴다
--   external     http(s) 인데 Storage URL 이 아니다 → 참조 아님. 정상
--   local_asset  '/' 로 시작한다 → Next.js /public 정적 파일. 참조 아님. 정상
--                (storage.objects 에 '/' 로 시작하는 이름이 0개임을 확인했다)
--   token        스킴도 '/' 도 없다 → 이모지·아이콘 이름. 참조 아님. 정상
--                (badge_groups.icon 🎮 등 9건. 같은 컬럼에 스토리지 URL 도 섞여 있어
--                 컬럼 자체를 목록에서 뺄 수는 없다)
--   ambiguous    버킷 없는 맨 경로처럼 보인다 → 대조 불가. 검사 불완전
--                '/' 를 포함하면서 스킴이 없는 값만 여기로 온다. 진짜 신호다.
create or replace view public.storage_reference_pairs as
with stripped as (
  select src, kind, bucket, val,
         btrim(split_part(val, '?', 1)) as no_qs
  from public.storage_reference_values
),
classified as (
  select src, kind, bucket, val, no_qs,
    case
      when no_qs ~ '/storage/v1/object/(public|sign|authenticated)/'
        then regexp_replace(no_qs, '^.*/storage/v1/object/(?:public|sign|authenticated)/', '')
      when no_qs ~ '/storage/v1/render/image/(public|sign|authenticated)/'
        then regexp_replace(no_qs, '^.*/storage/v1/render/image/(?:public|sign|authenticated)/', '')
      else null
    end as storage_tail
  from stripped
)
select src, kind, val,
       case
         when storage_tail is not null                then 'parsed'
         when kind = 'path' and bucket is not null     then 'parsed'
         when no_qs like '/%'                          then 'local_asset'
         when no_qs ~* '^https?://'                    then 'external'
         when position('/' in no_qs) = 0               then 'token'
         else 'ambiguous'
       end as status,
       case
         when storage_tail is not null then split_part(storage_tail, '/', 1)
         when kind = 'path' then bucket
         else null
       end as ref_bucket,
       case
         when storage_tail is not null
           then substring(storage_tail from position('/' in storage_tail) + 1)
         when kind = 'path' then ltrim(btrim(val), '/')
         else null
       end as ref_path
from classified;

comment on view public.storage_reference_pairs is
  '참조 값을 {bucket, path} 로 정규화한 결과. status=ambiguous 가 있으면 대조가 불완전하다.';


-- ============================================================
-- 3. 삭제 후보 보고서
-- ============================================================
create or replace function public.storage_deletion_candidates(
  p_recent_hours integer default 24,
  p_sample_limit integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions', 'pg_temp'
as $fn$
declare
  v_ambiguous bigint;
  v_sources   bigint;
  v_complete  boolean;
  v_cutoff    timestamptz;
  v_buckets   jsonb;
  v_ambig_src jsonb;
  v_status    jsonb;
begin
  if p_recent_hours < 0 then
    raise exception 'p_recent_hours 는 0 이상이어야 합니다' using errcode = '22023';
  end if;
  v_cutoff := now() - make_interval(hours => p_recent_hours);

  select count(*) filter (where status = 'ambiguous'),
         count(distinct src)
    into v_ambiguous, v_sources
  from public.storage_reference_pairs;

  v_complete := (v_ambiguous = 0);

  select coalesce(jsonb_object_agg(status, c), '{}'::jsonb) into v_status
  from (select status, count(*) as c from public.storage_reference_pairs group by status) s;

  -- 어떤 출처에서 파싱이 깨졌는지. 값 자체는 싣지 않는다.
  select coalesce(jsonb_agg(jsonb_build_object('src', src, 'count', c) order by c desc), '[]'::jsonb)
    into v_ambig_src
  from (
    select src, count(*) as c
    from public.storage_reference_pairs
    where status = 'ambiguous'
    group by src
  ) a;

  with refs as (
    select distinct ref_bucket as bucket, ref_path as path
    from public.storage_reference_pairs
    where status = 'parsed'
  ),
  objs as (
    select o.bucket_id,
           o.name,
           coalesce((o.metadata->>'size')::bigint, 0) as bytes,
           o.created_at,
           (o.created_at >= v_cutoff) as is_recent,
           not exists (
             select 1 from refs r
             where r.bucket = o.bucket_id and r.path = o.name
           ) as unreferenced
    from storage.objects o
  ),
  per_bucket as (
    select bucket_id,
           count(*)                                                             as total,
           count(*) filter (where unreferenced and not is_recent)                as candidates,
           coalesce(sum(bytes) filter (where unreferenced and not is_recent), 0) as candidate_bytes,
           count(*) filter (where unreferenced and is_recent)                    as recent_held,
           coalesce(sum(bytes) filter (where unreferenced and is_recent), 0)     as recent_held_bytes,
           coalesce(sum(bytes), 0)                                              as total_bytes
    from objs
    group by bucket_id
  )
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'bucket',             b.bucket_id,
             'total',              b.total,
             'total_bytes',        b.total_bytes,
             'candidates',         case when v_complete then b.candidates else null end,
             'candidate_bytes',    case when v_complete then b.candidate_bytes else null end,
             'recent_held',        b.recent_held,
             'recent_held_bytes',  b.recent_held_bytes,
             -- verify-documents 는 경로를 싣지 않는다. 민감 문서다.
             'paths_suppressed',   (b.bucket_id = 'verify-documents'),
             'sample',             case
                                     when not v_complete then null
                                     when b.bucket_id = 'verify-documents' then '[]'::jsonb
                                     else coalesce((
                                       select jsonb_agg(jsonb_build_object(
                                                'path', s.name, 'bytes', s.bytes,
                                                'created_at', s.created_at))
                                       from (
                                         select name, bytes, created_at
                                         from objs
                                         where bucket_id = b.bucket_id
                                           and unreferenced and not is_recent
                                         order by bytes desc
                                         limit p_sample_limit
                                       ) s
                                     ), '[]'::jsonb)
                                   end
           ) order by b.candidate_bytes desc, b.bucket_id
         ), '[]'::jsonb)
    into v_buckets
  from per_bucket b;

  return jsonb_build_object(
    'generated_at',      now(),
    'recent_hours',      p_recent_hours,
    'checked_sources',   v_sources,
    'complete',          v_complete,
    'ambiguous_count',   v_ambiguous,
    'ambiguous_sources', v_ambig_src,
    'status_counts',     v_status,
    'buckets',           v_buckets
  );
end;
$fn$;

comment on function public.storage_deletion_candidates(integer, integer) is
  '읽기 전용 Storage 삭제 후보 보고서. complete=false 면 건수를 신뢰하지 말 것. 삭제 기능은 없다.';


-- ============================================================
-- 권한 — service_role 전용
-- ============================================================
revoke all on public.storage_reference_values from public, anon, authenticated;
revoke all on public.storage_reference_pairs  from public, anon, authenticated;
grant  select on public.storage_reference_values to service_role;
grant  select on public.storage_reference_pairs  to service_role;

revoke execute on function public.storage_deletion_candidates(integer, integer) from public, anon, authenticated;
grant  execute on function public.storage_deletion_candidates(integer, integer) to service_role;

select pg_notify('pgrst', 'reload schema');
