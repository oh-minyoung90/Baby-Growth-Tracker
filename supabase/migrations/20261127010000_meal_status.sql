-- 식사 상태 한 번 변경으로 섭취 재계산과 반응 갱신을 같은 트랜잭션에서 처리한다.
-- 기존 식단 및 백업의 eaten/intake 값과 이전 앱이 쓰는 RPC는 보존한다.
create function public.set_meal_status(id uuid, status text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
  meal_date date;
begin
  if status is null or status not in ('planned', 'good', 'eaten', 'refused') then
    raise exception using errcode = '22023', message = '식사 상태가 올바르지 않습니다';
  end if;

  -- 본인 확인, 잠금, 음식 상태 계산을 기존 먹음 RPC와 공유한다.
  result := public.set_meal_eaten(id, status in ('good', 'eaten'));
  update public.meal_entries e
  set intake = case status
    when 'good' then 'good'
    when 'refused' then 'refuse'
    else null
  end
  where e.id = set_meal_status.id and e.owner_id = auth.uid()
  returning e.date into meal_date;

  -- 기기의 정확한 날짜는 화면에서 확인하며, 서버에서는 기존 먹음 제한과 같은 범위를 적용한다.
  if status = 'refused' and meal_date > (now() at time zone 'utc')::date + 1 then
    raise exception using errcode = '22007', message = '미래 식단은 예정으로만 기록할 수 있습니다';
  end if;

  return result;
end;
$$;

revoke execute on function public.set_meal_status(uuid, text) from public, anon;
grant execute on function public.set_meal_status(uuid, text) to authenticated;

create or replace function public.move_meal_entry(id uuid, date date, meal_type text, uncheck boolean)
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
  if id is null or date is null or meal_type is null or uncheck is null then
    raise exception using errcode = '22023', message = '이동할 식단과 날짜·끼니·체크 해제 여부가 필요합니다';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('meal:' || uid::text, 0));
  select * into existing from public.meal_entries e
  where e.id = move_meal_entry.id and e.owner_id = uid for update;
  if not found then
    raise exception using errcode = 'P0002', message = '식단을 찾을 수 없습니다';
  end if;
  select coalesce(array_agg(ef.food_id), '{}'::uuid[]) into affected
  from public.meal_entry_foods ef where ef.meal_entry_id = existing.id and ef.owner_id = uid;
  perform f.id from public.foods f
  where f.id = any(affected) and f.owner_id = uid order by f.id for update;

  -- 날짜·끼니 충돌은 유일 제약으로 거부한다.
  if not uncheck and existing.intake = 'refuse' and move_meal_entry.date > (now() at time zone 'utc')::date + 1 then
    raise exception using errcode = '22007', message = '미래 식단은 예정으로만 기록할 수 있습니다';
  end if;
  update public.meal_entries e set date = move_meal_entry.date,
    meal_type = move_meal_entry.meal_type,
    eaten = case when uncheck then false else existing.eaten end,
    intake = case when uncheck then null else existing.intake end
  where e.id = existing.id and e.owner_id = uid
    and (e.date is distinct from move_meal_entry.date
      or e.meal_type is distinct from move_meal_entry.meal_type
      or (uncheck and (e.eaten or e.intake is not null)));
  first_tried := public.recalc_meal_foods(affected, existing.id);
  return jsonb_build_object('id', existing.id, 'first_tried_foods', first_tried);
end;
$$;
