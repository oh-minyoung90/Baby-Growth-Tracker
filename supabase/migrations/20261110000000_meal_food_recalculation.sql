-- T-40: 식단 저장·먹음 체크·삭제와 음식 상태 재계산 (BR-11~13, BR-15, BR-17, D10~11)
-- 칸 변경 전에 관련 음식 행을 잠근다. 같은 사용자의 식단 함수는 직렬화해
-- 동시에 같은 칸을 저장하거나 여러 음식이 든 칸을 수정해도 계산을 빠뜨리지 않는다.

-- 내부 함수. 화면에서 직접 실행할 수 없다. 호출자의 음식만 계산한다.
create function public.recalc_food(food_id uuid, meal_entry_id uuid default null)
returns public.foods
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  existing public.foods;
  updated public.foods;
  eaten_min date;
  eaten_since_caution boolean;
  next_status text;
  next_tag boolean;
begin
  if uid is null then
    raise exception using errcode = '42501', message = '로그인이 필요합니다';
  end if;
  select * into existing from public.foods f
  where f.id = recalc_food.food_id and f.owner_id = uid for update;
  if not found then
    raise exception using errcode = 'P0002', message = '음식을 찾을 수 없습니다';
  end if;

  select min(e.date), coalesce(bool_or(e.date >= existing.caution_since), false)
  into eaten_min, eaten_since_caution
  from public.meal_entry_foods ef
  join public.meal_entries e on e.id = ef.meal_entry_id and e.owner_id = uid
  where ef.food_id = existing.id and ef.owner_id = uid and e.eaten;

  next_status := existing.status;
  next_tag := existing.caution_tag;
  if existing.status = 'caution' then
    if eaten_since_caution then
      next_status := 'tried';
      next_tag := true;
    end if;
  elsif existing.caution_tag then
    if not eaten_since_caution then
      next_status := 'caution';
      next_tag := false;
    end if;
  else
    next_status := case when eaten_min is not null or existing.manual_tried
      then 'tried' else 'not_tried' end;
  end if;

  update public.foods f set
    status = next_status,
    caution_tag = next_tag,
    first_tried_date = least(eaten_min, existing.manual_first_tried_date)
  where f.id = existing.id and f.owner_id = uid
  returning * into updated;

  -- 알러지·주의 상태의 자동 전환과 되돌림만 이력에 남긴다 (BR-13).
  if existing.status = 'caution' and next_tag then
    insert into public.food_status_history (
      owner_id, food_id, from_status, to_status, caution_tag, trigger, meal_entry_id
    ) values (uid, existing.id, 'caution', 'tried', true, 'meal_entry', recalc_food.meal_entry_id);
  elsif existing.caution_tag and next_status = 'caution' then
    insert into public.food_status_history (
      owner_id, food_id, from_status, to_status, caution_tag, trigger, meal_entry_id
    ) values (uid, existing.id, 'tried', 'caution', false, 'revert', recalc_food.meal_entry_id);
  end if;
  return updated;
end;
$$;

revoke execute on function public.recalc_food(uuid, uuid) from public, anon, authenticated;

-- 재계산과 첫 시도 알림 목록을 공통 처리한다. 음식 행은 호출 함수가 변경 전에 잠근다.
create function public.recalc_meal_foods(food_ids uuid[], meal_entry_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing public.foods;
  updated public.foods;
  first_tried jsonb := '[]'::jsonb;
begin
  for existing in
    select * from public.foods f
    where f.owner_id = auth.uid() and f.id = any(food_ids) order by f.id for update
  loop
    updated := public.recalc_food(existing.id, recalc_meal_foods.meal_entry_id);
    -- 날짜를 모르는 "이미 먹어 봤어요" 음식은 첫 시도 알림에서 제외한다 (BR-17).
    if existing.first_tried_date is null and not existing.manual_tried
      and updated.first_tried_date is not null then
      first_tried := first_tried || jsonb_build_array(
        jsonb_build_object('id', updated.id, 'name', updated.name)
      );
    end if;
  end loop;
  return first_tried;
end;
$$;

revoke execute on function public.recalc_meal_foods(uuid[], uuid) from public, anon, authenticated;

-- foods: [{food_id, food_name}], recipes: [{recipe_id, recipe_name}]. 배열 순서대로 저장한다.
-- 연결된 음식 이름은 DB에서 가져온다. 삭제된 음식·레시피는 null ID와 남아 있는 이름으로 보존한다.
-- 레시피 ID 소유권 검증은 recipes 테이블과 외래 키를 만드는 T-47에서 추가한다.
create function public.save_meal_entry(
  id uuid default null,
  date date default null,
  meal_type text default null,
  eaten boolean default false,
  foods jsonb default '[]'::jsonb,
  recipes jsonb default '[]'::jsonb,
  intake text default null,
  memo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  entry_id uuid;
  affected uuid[];
  first_tried jsonb;
begin
  if uid is null then
    raise exception using errcode = '42501', message = '로그인이 필요합니다';
  end if;
  if foods is null or recipes is null
    or jsonb_typeof(foods) <> 'array' or jsonb_typeof(recipes) <> 'array' then
    raise exception using errcode = '22023', message = '음식과 레시피는 배열이어야 합니다';
  end if;
  if jsonb_array_length(foods) + jsonb_array_length(recipes) = 0 then
    raise exception using errcode = '22023', message = '음식이나 레시피를 하나 이상 선택해 주세요';
  end if;
  if exists (select 1 from jsonb_array_elements(foods) x where jsonb_typeof(x) <> 'object')
    or exists (select 1 from jsonb_array_elements(recipes) x where jsonb_typeof(x) <> 'object') then
    raise exception using errcode = '22023', message = '음식과 레시피 항목의 형식이 올바르지 않습니다';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('meal:' || uid::text, 0));
  if save_meal_entry.id is not null then
    select e.id into entry_id from public.meal_entries e
    where e.id = save_meal_entry.id and e.owner_id = uid for update;
    if not found then
      raise exception using errcode = 'P0002', message = '식단을 찾을 수 없습니다';
    end if;
  end if;

  select coalesce(array_agg(distinct food_id), '{}'::uuid[]) into affected from (
    select ef.food_id from public.meal_entry_foods ef
    where ef.meal_entry_id = entry_id and ef.owner_id = uid
    union
    select (x ->> 'food_id')::uuid from jsonb_array_elements(foods) x
  ) related where food_id is not null;
  perform f.id from public.foods f
  where f.id = any(affected) and f.owner_id = uid order by f.id for update;
  if exists (
    select 1 from jsonb_array_elements(foods) x
    where (x ->> 'food_id') is not null and not exists (
      select 1 from public.foods f where f.id = (x ->> 'food_id')::uuid and f.owner_id = uid
    )
  ) then
    raise exception using errcode = '23503', message = '본인의 음식만 선택할 수 있습니다';
  end if;

  if entry_id is null then
    insert into public.meal_entries (owner_id, date, meal_type, eaten, intake, memo)
    values (uid, save_meal_entry.date, save_meal_entry.meal_type, save_meal_entry.eaten,
      save_meal_entry.intake, save_meal_entry.memo)
    returning meal_entries.id into entry_id;
  else
    -- 날짜·체크가 그대로면 날짜 검증 트리거를 다시 실행하지 않는다 (T-39).
    update public.meal_entries e set intake = save_meal_entry.intake, memo = save_meal_entry.memo
    where e.id = entry_id and e.owner_id = uid;
    update public.meal_entries e set date = save_meal_entry.date,
      meal_type = save_meal_entry.meal_type, eaten = save_meal_entry.eaten
    where e.id = entry_id and e.owner_id = uid
      and (e.date is distinct from save_meal_entry.date
        or e.meal_type is distinct from save_meal_entry.meal_type
        or e.eaten is distinct from save_meal_entry.eaten);
    delete from public.meal_entry_foods ef where ef.meal_entry_id = entry_id and ef.owner_id = uid;
    delete from public.meal_entry_recipes er where er.meal_entry_id = entry_id and er.owner_id = uid;
  end if;

  insert into public.meal_entry_foods (owner_id, meal_entry_id, food_id, food_name, position)
  select uid, entry_id, (x.value ->> 'food_id')::uuid,
    coalesce(f.name, x.value ->> 'food_name'), x.ordinality::integer - 1
  from jsonb_array_elements(foods) with ordinality x(value, ordinality)
  left join public.foods f on f.id = (x.value ->> 'food_id')::uuid and f.owner_id = uid;
  insert into public.meal_entry_recipes (owner_id, meal_entry_id, recipe_id, recipe_name, position)
  select uid, entry_id, (x.value ->> 'recipe_id')::uuid,
    x.value ->> 'recipe_name', x.ordinality::integer - 1
  from jsonb_array_elements(recipes) with ordinality x(value, ordinality);

  first_tried := public.recalc_meal_foods(affected, entry_id);
  return jsonb_build_object('id', entry_id, 'first_tried_foods', first_tried);
end;
$$;

create function public.set_meal_eaten(id uuid, eaten boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  existing public.meal_entries;
  affected uuid[];
  first_tried jsonb;
begin
  if uid is null then
    raise exception using errcode = '42501', message = '로그인이 필요합니다';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('meal:' || uid::text, 0));
  select * into existing from public.meal_entries e
  where e.id = set_meal_eaten.id and e.owner_id = uid for update;
  if not found then
    raise exception using errcode = 'P0002', message = '식단을 찾을 수 없습니다';
  end if;
  select coalesce(array_agg(ef.food_id), '{}'::uuid[]) into affected
  from public.meal_entry_foods ef where ef.meal_entry_id = existing.id and ef.owner_id = uid;
  perform f.id from public.foods f
  where f.id = any(affected) and f.owner_id = uid order by f.id for update;
  update public.meal_entries e set eaten = set_meal_eaten.eaten
  where e.id = existing.id and e.owner_id = uid;
  first_tried := public.recalc_meal_foods(affected, existing.id);
  return jsonb_build_object('id', existing.id, 'first_tried_foods', first_tried);
end;
$$;

create function public.delete_meal_entry(id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  entry_id uuid;
  affected uuid[];
begin
  if uid is null then
    raise exception using errcode = '42501', message = '로그인이 필요합니다';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('meal:' || uid::text, 0));
  select e.id into entry_id from public.meal_entries e
  where e.id = delete_meal_entry.id and e.owner_id = uid for update;
  if not found then
    raise exception using errcode = 'P0002', message = '식단을 찾을 수 없습니다';
  end if;
  select coalesce(array_agg(ef.food_id), '{}'::uuid[]) into affected
  from public.meal_entry_foods ef where ef.meal_entry_id = entry_id and ef.owner_id = uid;
  perform f.id from public.foods f
  where f.id = any(affected) and f.owner_id = uid order by f.id for update;
  delete from public.meal_entries e where e.id = entry_id and e.owner_id = uid;
  -- 삭제한 칸은 이력 외래 키의 대상이 아니므로 null을 보낸다.
  perform public.recalc_meal_foods(affected, null);
end;
$$;

-- 이미 먹어 봤어요를 바꿀 때도 식단 기록과 함께 재계산한다 (BR-17).
create or replace function public.update_food(
  food_id uuid, name text, food_group text, memo text default null,
  already_tried boolean default null, first_tried_date date default null, preference text default null
)
returns public.foods
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  existing public.foods;
begin
  if uid is null then
    raise exception using errcode = '42501', message = '로그인이 필요합니다';
  end if;
  if update_food.first_tried_date is not null and not coalesce(update_food.already_tried, false) then
    raise exception using errcode = '22023', message = '처음 먹은 날은 이미 먹어 본 음식에만 입력할 수 있습니다';
  end if;
  select * into existing from public.foods f
  where f.id = update_food.food_id and f.owner_id = uid for update;
  if not found then
    raise exception using errcode = 'P0002', message = '음식을 찾을 수 없습니다';
  end if;
  if update_food.already_tried is not null and existing.status = 'caution' then
    raise exception using errcode = '22023', message = '알러지·주의 음식은 지정·해제로만 상태가 바뀝니다';
  end if;
  update public.foods f set name = update_food.name, food_group = update_food.food_group,
    memo = update_food.memo, preference = update_food.preference
  where f.id = existing.id and f.owner_id = uid;
  if update_food.already_tried is not null
    and (existing.manual_tried is distinct from update_food.already_tried
      or existing.manual_first_tried_date is distinct from update_food.first_tried_date) then
    update public.foods f set manual_tried = update_food.already_tried,
      manual_first_tried_date = update_food.first_tried_date,
      -- manual_tried=true와 status=not_tried의 조합을 CHECK가 거부하므로 함께 바꾼다.
      status = case when update_food.already_tried and f.status = 'not_tried' then 'tried' else f.status end
    where f.id = existing.id and f.owner_id = uid;
  end if;
  return public.recalc_food(existing.id);
end;
$$;

create or replace function public.release_food_caution(food_id uuid, reason text default null)
returns public.foods
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  existing public.foods;
  updated public.foods;
begin
  if uid is null then
    raise exception using errcode = '42501', message = '로그인이 필요합니다';
  end if;
  select * into existing from public.foods f
  where f.id = release_food_caution.food_id and f.owner_id = uid for update;
  if not found then
    raise exception using errcode = 'P0002', message = '음식을 찾을 수 없습니다';
  end if;
  if existing.status <> 'caution' then
    raise exception using errcode = '22023', message = '알러지·주의 음식이 아닙니다';
  end if;
  update public.foods f set
    status = case when existing.manual_tried then 'tried' else 'not_tried' end,
    caution_tag = false, caution_since = null, reaction_date = null,
    symptom_note = null, check_note = null
  where f.id = existing.id and f.owner_id = uid;
  updated := public.recalc_food(existing.id);
  insert into public.food_status_history (
    owner_id, food_id, from_status, to_status, caution_tag, trigger, reason,
    reaction_date, symptom_note, check_note
  ) values (uid, existing.id, 'caution', updated.status, false, 'manual', release_food_caution.reason,
    existing.reaction_date, existing.symptom_note, existing.check_note);
  return updated;
end;
$$;

-- 재계산을 우회하는 직접 추가·수정·삭제를 막는다 (D10). 조회 RLS는 유지한다.
revoke insert, update, delete, truncate, references, trigger
  on public.meal_entries, public.meal_entry_foods, public.meal_entry_recipes from anon, authenticated;
revoke execute on function public.save_meal_entry(uuid, date, text, boolean, jsonb, jsonb, text, text) from public, anon;
grant execute on function public.save_meal_entry(uuid, date, text, boolean, jsonb, jsonb, text, text) to authenticated;
revoke execute on function public.set_meal_eaten(uuid, boolean) from public, anon;
grant execute on function public.set_meal_eaten(uuid, boolean) to authenticated;
revoke execute on function public.delete_meal_entry(uuid) from public, anon;
grant execute on function public.delete_meal_entry(uuid) to authenticated;

comment on function public.recalc_food(uuid, uuid) is '내부 전용: 식단과 직접 입력을 기준으로 음식 상태·처음 먹은 날 재계산 (BR-11~13, BR-17, D11)';
comment on function public.save_meal_entry(uuid, date, text, boolean, jsonb, jsonb, text, text) is '식단 칸 저장·관련 음식 재계산. {id, first_tried_foods: [{id, name}]} 반환 (T-40)';
comment on function public.set_meal_eaten(uuid, boolean) is '먹음 체크와 재계산. {id, first_tried_foods: [{id, name}]} 반환 (T-40)';
comment on function public.delete_meal_entry(uuid) is '식단 칸 삭제·관련 음식 재계산 (T-40)';
