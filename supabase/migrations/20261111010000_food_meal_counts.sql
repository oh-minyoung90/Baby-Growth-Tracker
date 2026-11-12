-- T-46: 음식 목록의 먹은 횟수. 계획·레시피 재료는 세지 않는다 (FR-FOOD-03, BR-15).
-- 화면 조회의 행 수 제한과 관계없이 집계하며 호출자의 RLS를 그대로 적용한다.
create function public.food_meal_counts()
returns table (food_id uuid, eaten_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select ef.food_id, count(*)
  from public.meal_entry_foods ef
  join public.meal_entries e on e.id = ef.meal_entry_id and e.owner_id = ef.owner_id
  where ef.owner_id = auth.uid() and e.eaten and ef.food_id is not null
  group by ef.food_id;
$$;
revoke execute on function public.food_meal_counts() from public, anon;
grant execute on function public.food_meal_counts() to authenticated;
comment on function public.food_meal_counts() is '본인의 음식별 먹음 식단 횟수. 계획·삭제된 음식·레시피 재료 제외 (T-46)';
