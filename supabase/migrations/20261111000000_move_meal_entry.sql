-- T-41: 식단 칸 이동. 저장·체크·삭제와 같은 잠금 순서로 재계산한다.
create function public.move_meal_entry(id uuid, date date, meal_type text, uncheck boolean)
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

  -- 날짜·끼니 유일 제약으로 충돌을 거부한다. 실패하면 체크·재계산도 모두 취소된다.
  -- 기기의 정확한 미래 판단과 확인 창은 화면에서 처리한다 (D2, T-45).
  -- 서버에서는 기존 날짜 트리거(UTC 오늘 + 1일)가 먹음 상태의 미래 이동을 제한한다.
  update public.meal_entries e set date = move_meal_entry.date,
    meal_type = move_meal_entry.meal_type,
    eaten = case when uncheck then false else existing.eaten end
  where e.id = existing.id and e.owner_id = uid
    and (e.date is distinct from move_meal_entry.date
      or e.meal_type is distinct from move_meal_entry.meal_type
      or (uncheck and e.eaten));
  first_tried := public.recalc_meal_foods(affected, existing.id);
  return jsonb_build_object('id', existing.id, 'first_tried_foods', first_tried);
end;
$$;

revoke execute on function public.move_meal_entry(uuid, date, text, boolean) from public, anon;
grant execute on function public.move_meal_entry(uuid, date, text, boolean) to authenticated;
comment on function public.move_meal_entry(uuid, date, text, boolean) is '식단 이동·충돌 거부·명시적 체크 해제·음식 재계산. {id, first_tried_foods} 반환 (T-41)';
