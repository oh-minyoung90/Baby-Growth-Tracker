-- T-31: 사진 파일은 Storage API로 먼저 정리하고 DB 기록을 원자적으로 삭제한다.
create function public.delete_all_data(expected_owner_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); table_name text;
begin
  if uid is null or expected_owner_id is distinct from uid then
    raise exception using errcode='42501', message='delete_auth';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('meal:' || uid::text, 0));
  lock table public.children, public.body_measures, public.milestones, public.sleep_logs,
    public.foods, public.photos, public.recipes, public.recipe_ingredients, public.meal_entries,
    public.meal_entry_foods, public.meal_entry_recipes, public.food_status_history in exclusive mode;
  -- 메타데이터가 없는 파일도 확인한다. 다른 사용자의 폴더는 검사·삭제하지 않는다.
  if exists (select 1 from storage.objects where bucket_id='recipe-photos'
    and name like uid::text || '/%') then
    raise exception using errcode='22023', message='delete_photos_remaining';
  end if;
  foreach table_name in array ARRAY['food_status_history','meal_entry_foods','meal_entry_recipes',
    'meal_entries','recipe_ingredients','recipes','photos','foods','sleep_logs','milestones','body_measures','children'] loop
    execute format('delete from public.%I where owner_id=$1',table_name) using uid;
  end loop;
  -- auth.users·인증 세션은 그대로 둔다. 테이블 삭제 중 실패하면 전체 트랜잭션이 취소된다.
end;
$$;
revoke all on function public.delete_all_data(uuid) from public, anon;
grant execute on function public.delete_all_data(uuid) to authenticated;
