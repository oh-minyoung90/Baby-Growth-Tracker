-- T-37: 아이 반응 4단계(매우 좋아함·좋아함·보통·거부)와 추가·수정 시 반응 입력
-- 기준: 기능요구사항서 FR-FOOD-04, FR-FOOD-10, R46, 기술요구사항서 5.3, 8.2
-- 반응은 음식 상세(T-46)뿐 아니라 추가·수정 시트에서도 고른다 (R46). 그래서 add_food·update_food가 반응도 받는다.
-- 인자가 늘어 함수의 모양(시그니처)이 바뀌므로 이전 함수를 지우고 다시 만든다.

-- ---------------------------------------------------------------
-- 반응 값: love(매우 좋아함) 추가
-- ---------------------------------------------------------------
alter table public.foods drop constraint foods_preference_check;
alter table public.foods
  add constraint foods_preference_check check (preference in ('love', 'like', 'neutral', 'refuse'));

comment on column public.foods.preference is
  '아이 반응: love(매우 좋아함), like(좋아함), neutral(보통), refuse(거부). 고르지 않았으면 null (FR-FOOD-10)';

-- ---------------------------------------------------------------
-- add_food: 음식 추가 (FR-FOOD-04~05, BR-17). T-36과 같고 반응(선택)을 더 받는다
-- ---------------------------------------------------------------
drop function public.add_food(text, text, text, boolean, date);

create function public.add_food(
  name text,
  food_group text,
  memo text default null,
  already_tried boolean default false,
  first_tried_date date default null,
  preference text default null
)
returns public.foods
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  tried boolean := coalesce(add_food.already_tried, false);
  added public.foods;
begin
  if uid is null then
    raise exception using errcode = '42501', message = '로그인이 필요합니다';
  end if;
  if add_food.first_tried_date is not null and not tried then
    raise exception using
      errcode = '22023',
      message = '처음 먹은 날은 이미 먹어 본 음식에만 입력할 수 있습니다';
  end if;

  insert into public.foods (
    owner_id, name, food_group, memo, preference,
    status, manual_tried, manual_first_tried_date, first_tried_date
  )
  values (
    uid, add_food.name, add_food.food_group, add_food.memo, add_food.preference,
    case when tried then 'tried' else 'not_tried' end,
    tried, add_food.first_tried_date, add_food.first_tried_date
  )
  returning * into added;

  return added;
end;
$$;

comment on function public.add_food(text, text, text, boolean, date, text) is
  '음식 추가. already_tried면 먹어봄으로 저장 (FR-FOOD-04~05, BR-17, R46). security definer (D10)';

-- ---------------------------------------------------------------
-- update_food: 음식 수정 (FR-FOOD-04~05, BR-17, R45). T-37 첫 버전과 같고 반응도 함께 저장한다.
-- 반응은 화면이 보낸 값으로 바꾼다 (null이면 지움).
-- ---------------------------------------------------------------
drop function public.update_food(uuid, text, text, text, boolean, date);

create function public.update_food(
  food_id uuid,
  name text,
  food_group text,
  memo text default null,
  already_tried boolean default null,
  first_tried_date date default null,
  preference text default null
)
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
  if update_food.first_tried_date is not null and not coalesce(update_food.already_tried, false) then
    raise exception using
      errcode = '22023',
      message = '처음 먹은 날은 이미 먹어 본 음식에만 입력할 수 있습니다';
  end if;

  select * into existing
  from public.foods f
  where f.id = update_food.food_id and f.owner_id = uid
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = '음식을 찾을 수 없습니다';
  end if;
  if update_food.already_tried is not null and existing.status = 'caution' then
    raise exception using
      errcode = '22023',
      message = '알러지·주의 음식은 지정·해제로만 상태가 바뀝니다';
  end if;

  update public.foods f
  set
    name = update_food.name,
    food_group = update_food.food_group,
    memo = update_food.memo,
    preference = update_food.preference
  where f.id = existing.id
  returning * into updated;

  -- 바뀐 경우에만 쓴다. 처음 먹은 날 검증 트리거는 이 컬럼이 바뀔 때만 동작하므로,
  -- 생년월일을 고친 뒤에도 이름·메모만 고치는 저장은 막히지 않는다
  if update_food.already_tried is not null
    and (existing.manual_tried is distinct from update_food.already_tried
      or existing.manual_first_tried_date is distinct from update_food.first_tried_date)
  then
    -- 지금은 식단 기록이 없으므로 manual 값만으로 정한다. 식단 연동(T-40)에서 recalc_food로 바꾼다 (BR-17)
    update public.foods f
    set
      manual_tried = update_food.already_tried,
      manual_first_tried_date = update_food.first_tried_date,
      status = case when update_food.already_tried then 'tried' else 'not_tried' end,
      first_tried_date = update_food.first_tried_date
    where f.id = existing.id
    returning * into updated;
  end if;

  return updated;
end;
$$;

comment on function public.update_food(uuid, text, text, text, boolean, date, text) is
  '음식 수정. already_tried를 주면 먹어 봤는지 여부도 바꿈. 반응도 함께 저장 (FR-FOOD-04~05, BR-17, R45~46). security definer (D10)';

-- 로그인한 사용자만 호출할 수 있다 (Supabase는 새 함수를 anon에게도 열어 두므로 뺀다)
revoke execute on function public.add_food(text, text, text, boolean, date, text) from public, anon;
grant execute on function public.add_food(text, text, text, boolean, date, text) to authenticated;
revoke execute on function public.update_food(uuid, text, text, text, boolean, date, text) from public, anon;
grant execute on function public.update_food(uuid, text, text, text, boolean, date, text) to authenticated;
