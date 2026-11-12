-- 사용자 요청: 원본의 음식·레시피·메모를 다른 날짜·끼니의 새 계획으로 복사한다.
-- 신규 식단의 생년월일 이전 날짜도 DB에서 거부한다. 기존 기록의 메모 수정은 막지 않는다.
create trigger meal_entries_reject_before_birth_insert
  before insert on public.meal_entries for each row
  execute function public.reject_before_birth('date');
create trigger meal_entries_reject_before_birth_update
  before update of date on public.meal_entries for each row
  when (new.date is distinct from old.date)
  execute function public.reject_before_birth('date');

create function public.copy_meal_entry(id uuid, date date, meal_type text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  source public.meal_entries;
  foods jsonb;
  recipes jsonb;
begin
  if uid is null then
    raise exception using errcode = '42501', message = '로그인이 필요합니다';
  end if;
  if id is null or date is null or meal_type is null then
    raise exception using errcode = '22023', message = '원본 식단과 복사할 날짜·끼니가 필요합니다';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('meal:' || uid::text, 0));
  select * into source from public.meal_entries e
  where e.id = copy_meal_entry.id and e.owner_id = uid for share;
  if not found then
    raise exception using errcode = 'P0002', message = '식단을 찾을 수 없습니다';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('food_id', ef.food_id, 'food_name', ef.food_name) order by ef.position), '[]'::jsonb)
  into foods from public.meal_entry_foods ef where ef.meal_entry_id = source.id and ef.owner_id = uid;
  select coalesce(jsonb_agg(jsonb_build_object('recipe_id', er.recipe_id, 'recipe_name', er.recipe_name) order by er.position), '[]'::jsonb)
  into recipes from public.meal_entry_recipes er where er.meal_entry_id = source.id and er.owner_id = uid;
  -- 저장 함수가 대상 충돌·소유권·현재 이름·이름 보존을 같은 트랜잭션에서 검증한다.
  -- 먹음·섭취량은 복사하지 않으므로 음식 상태·횟수·첫 시도 알림도 새로 생기지 않는다.
  return public.save_meal_entry(null, copy_meal_entry.date, copy_meal_entry.meal_type,
    false, foods, recipes, null, source.memo);
end;
$$;
revoke execute on function public.copy_meal_entry(uuid, date, text) from public, anon;
grant execute on function public.copy_meal_entry(uuid, date, text) to authenticated;
comment on function public.copy_meal_entry(uuid, date, text) is '본인 식단의 음식·레시피·메모를 먹음/섭취량 없는 새 계획으로 복사. 원본 유지, 대상 충돌 거부 (T-53)';
