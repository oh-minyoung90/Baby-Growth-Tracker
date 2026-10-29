-- T-37: 음식 수정 함수 update_food
-- 기준: 기술요구사항서 8.2(D10), 기능요구사항서 FR-FOOD-04~06, BR-17, R45
-- 기본 음식(부록 B)은 아직 안 먹어봄으로 추가되므로, 앱을 쓰기 전에 먹어 본 음식은
-- 수정 화면에서도 "이미 먹어 봤어요"를 고를 수 있게 한다 (R45). 상태 컬럼을 바꾸므로 DB 함수로만 한다 (D10).

-- ---------------------------------------------------------------
-- update_food: 이름·식품군·메모와 "이미 먹어 봤어요"(선택)를 한 번에 저장 (FR-FOOD-04~05, R45)
-- already_tried가 null이면 먹어 봤는지 여부와 처음 먹은 날은 그대로 둔다 (알러지·주의 음식 등).
-- already_tried를 주면 manual_tried·manual_first_tried_date를 바꾸고 상태와 처음 먹은 날을 다시 정한다.
--   지금은 식단 기록이 없으므로 manual 값만으로 정한다. 식단 연동(T-40)에서 recalc_food로 바꾼다 (BR-17).
-- 알러지·주의 음식의 상태는 지정·해제(T-38)로만 바뀌므로 already_tried를 받지 않는다 (22023).
-- 같은 이름은 unique 제약이 23505로 거부한다 (BR-18). 내 음식이 아니거나 없으면 P0002.
-- ---------------------------------------------------------------
create or replace function public.update_food(
  food_id uuid,
  name text,
  food_group text,
  memo text default null,
  already_tried boolean default null,
  first_tried_date date default null
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
  set name = update_food.name, food_group = update_food.food_group, memo = update_food.memo
  where f.id = existing.id
  returning * into updated;

  -- 바뀐 경우에만 쓴다. 처음 먹은 날 검증 트리거는 이 컬럼이 바뀔 때만 동작하므로,
  -- 생년월일을 고친 뒤에도 이름·메모만 고치는 저장은 막히지 않는다
  if update_food.already_tried is not null
    and (existing.manual_tried is distinct from update_food.already_tried
      or existing.manual_first_tried_date is distinct from update_food.first_tried_date)
  then
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

comment on function public.update_food(uuid, text, text, text, boolean, date) is
  '음식 수정. already_tried를 주면 먹어 봤는지 여부도 바꿈 (FR-FOOD-04~05, BR-17, R45). security definer (D10)';

-- 로그인한 사용자만 호출할 수 있다 (Supabase는 새 함수를 anon에게도 열어 두므로 뺀다)
revoke execute on function public.update_food(uuid, text, text, text, boolean, date) from public, anon;
grant execute on function public.update_food(uuid, text, text, text, boolean, date) to authenticated;
