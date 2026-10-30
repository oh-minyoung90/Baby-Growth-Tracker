-- T-38: 알러지·주의 지정·해제, "주의" 태그 해제
-- 기준: 기능요구사항서 FR-FOOD-11~14, BR-11, BR-13, R48~R49, 기술요구사항서 5.3, 8.2(D10~D11)
-- - set_food_caution: 알러지·주의로 지정. 이미 알러지·주의면 반응 날짜·메모만 고친다
-- - release_food_caution: 알러지·주의 해제 (먹은 기록이 있으면 먹어봄, 없으면 아직 안 먹어봄)
-- - clear_caution_tag: 먹어봄 음식의 "주의" 태그 해제
-- 해제·태그 해제 때는 그동안의 알러지·주의 정보(반응 날짜, 증상 메모, 확인 메모)를 이력에 옮겨 적고
-- 음식에서는 지운다 (R49). 다시 지정하면 빈 칸에서 시작한다.

-- ---------------------------------------------------------------
-- food_status_history: 해제할 때 옮겨 적는 알러지·주의 정보 (R49)
-- ---------------------------------------------------------------
alter table public.food_status_history
  add column reaction_date date,
  add column symptom_note text,
  add column check_note text,
  add constraint food_status_history_symptom_note_length check (char_length(symptom_note) <= 500),
  add constraint food_status_history_check_note_length check (char_length(check_note) <= 500);

comment on column public.food_status_history.reaction_date is
  '알러지·주의 해제·"주의" 태그 해제 때 음식에서 옮겨 적은 반응 날짜 (R49). 그 밖의 이력은 null';
comment on column public.food_status_history.symptom_note is '해제 때 옮겨 적은 증상 메모 (R49)';
comment on column public.food_status_history.check_note is '해제 때 옮겨 적은 확인 메모 (R49)';

-- ---------------------------------------------------------------
-- foods: 알러지·주의 정보 규칙
-- ---------------------------------------------------------------
alter table public.foods
  -- 알러지·주의 음식에는 반응 날짜가 있다 (FR-FOOD-11)
  add constraint foods_caution_has_reaction_date
    check (status <> 'caution' or reaction_date is not null),
  -- 지정한 날(caution_since)은 알러지·주의이거나 "주의" 태그가 붙어 있는 동안에만 있다 (D11)
  add constraint foods_caution_since_while_caution
    check ((status = 'caution' or caution_tag) = (caution_since is not null)),
  -- 알러지·주의 정보도 그동안에만 음식에 있다. 해제하면 이력으로 옮긴다 (R49)
  add constraint foods_caution_info_while_caution
    check (
      status = 'caution' or caution_tag
      or (reaction_date is null and symptom_note is null and check_note is null)
    );

-- 반응 날짜: 미래·생년월일 이전 거부 (FR-FOOD-11, FR-COM-03~04).
-- 이 컬럼을 쓸 때만 검사한다. 아래 함수는 값이 바뀔 때만 쓰므로, 생년월일을 고친 뒤에도 메모는 고칠 수 있다
create trigger foods_reject_future_reaction
  before insert or update of reaction_date on public.foods
  for each row execute function public.reject_future_date('reaction_date');

create trigger foods_reject_reaction_before_birth
  before insert or update of reaction_date on public.foods
  for each row execute function public.reject_before_birth('reaction_date');

-- 지정한 날: 화면이 기기의 오늘을 보내므로(D2: 서버는 기기 시간대를 모름) 미래만 한 번 더 막는다
create trigger foods_reject_future_caution_since
  before insert or update of caution_since on public.foods
  for each row execute function public.reject_future_date('caution_since');

-- ---------------------------------------------------------------
-- set_food_caution: 알러지·주의 지정 (FR-FOOD-11, BR-11, BR-13)
-- 아직 안 먹어봄·먹어봄(주의 태그 포함) → 알러지·주의. 이력(manual)을 남긴다.
-- today: 기기의 오늘. 지정한 날(caution_since)로 저장한다 (D11)
-- 이미 알러지·주의면 반응 날짜·메모만 고친다. 상태와 지정한 날은 그대로이고 이력도 남기지 않는다(사유는 쓰지 않음).
-- 처음 먹은 날, "이미 먹어 봤어요", 반응(preference)은 그대로 둔다.
-- ---------------------------------------------------------------
create function public.set_food_caution(
  food_id uuid,
  reaction_date date,
  today date,
  symptom_note text default null,
  check_note text default null,
  reason text default null
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
  if set_food_caution.reaction_date is null or set_food_caution.today is null then
    raise exception using errcode = '22023', message = '반응 날짜와 오늘 날짜가 필요합니다';
  end if;
  -- 오늘(기기 기준)보다 늦은 반응 날짜. 날짜 검증 트리거와 같은 오류 코드를 쓴다
  if set_food_caution.reaction_date > set_food_caution.today then
    raise exception using errcode = '22007', message = '반응 날짜는 오늘 이후일 수 없습니다';
  end if;

  select * into existing
  from public.foods f
  where f.id = set_food_caution.food_id and f.owner_id = uid
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = '음식을 찾을 수 없습니다';
  end if;

  if existing.status = 'caution' then
    update public.foods f
    set
      symptom_note = set_food_caution.symptom_note,
      check_note = set_food_caution.check_note
    where f.id = existing.id
    returning * into updated;

    if existing.reaction_date is distinct from set_food_caution.reaction_date then
      update public.foods f
      set reaction_date = set_food_caution.reaction_date
      where f.id = existing.id
      returning * into updated;
    end if;
    return updated;
  end if;

  update public.foods f
  set
    status = 'caution',
    caution_tag = false,
    caution_since = set_food_caution.today,
    reaction_date = set_food_caution.reaction_date,
    symptom_note = set_food_caution.symptom_note,
    check_note = set_food_caution.check_note
  where f.id = existing.id
  returning * into updated;

  insert into public.food_status_history (
    owner_id, food_id, from_status, to_status, caution_tag, trigger, reason
  )
  values (uid, existing.id, existing.status, 'caution', false, 'manual', set_food_caution.reason);

  return updated;
end;
$$;

comment on function public.set_food_caution(uuid, date, date, text, text, text) is
  '알러지·주의 지정 + 이력. 이미 알러지·주의면 정보만 수정 (FR-FOOD-11, BR-11, BR-13, D11). security definer (D10)';

-- ---------------------------------------------------------------
-- release_food_caution: 알러지·주의 해제 (FR-FOOD-12, BR-11, BR-13, R49)
-- 먹은 기록이 있으면 먹어봄, 없으면 아직 안 먹어봄. 알러지·주의 정보는 이력에 옮겨 적고 지운다.
-- ---------------------------------------------------------------
create function public.release_food_caution(food_id uuid, reason text default null)
returns public.foods
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  existing public.foods;
  next_status text;
  updated public.foods;
begin
  if uid is null then
    raise exception using errcode = '42501', message = '로그인이 필요합니다';
  end if;

  select * into existing
  from public.foods f
  where f.id = release_food_caution.food_id and f.owner_id = uid
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = '음식을 찾을 수 없습니다';
  end if;
  if existing.status <> 'caution' then
    raise exception using errcode = '22023', message = '알러지·주의 음식이 아닙니다';
  end if;

  -- 지금은 식단 기록이 없어 "이미 먹어 봤어요"(BR-17)만 먹은 기록으로 본다. 식단 연동(T-40)에서 recalc_food로 바꾼다
  next_status := case when existing.manual_tried then 'tried' else 'not_tried' end;

  update public.foods f
  set
    status = next_status,
    caution_since = null,
    reaction_date = null,
    symptom_note = null,
    check_note = null,
    first_tried_date = case when next_status = 'tried' then existing.first_tried_date end
  where f.id = existing.id
  returning * into updated;

  insert into public.food_status_history (
    owner_id, food_id, from_status, to_status, caution_tag, trigger, reason,
    reaction_date, symptom_note, check_note
  )
  values (
    uid, existing.id, 'caution', next_status, false, 'manual', release_food_caution.reason,
    existing.reaction_date, existing.symptom_note, existing.check_note
  );

  return updated;
end;
$$;

comment on function public.release_food_caution(uuid, text) is
  '알러지·주의 해제 + 이력(알러지·주의 정보 포함) (FR-FOOD-12, BR-11, BR-13, R49). security definer (D10)';

-- ---------------------------------------------------------------
-- clear_caution_tag: 먹어봄 음식의 "주의" 태그 해제 (FR-FOOD-13, BR-11, BR-13, R49)
-- "주의" 태그는 알러지·주의 음식을 식단에서 먹었을 때 붙는다(T-40). 상태는 먹어봄 그대로다.
-- ---------------------------------------------------------------
create function public.clear_caution_tag(food_id uuid, reason text default null)
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

  select * into existing
  from public.foods f
  where f.id = clear_caution_tag.food_id and f.owner_id = uid
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = '음식을 찾을 수 없습니다';
  end if;
  if not existing.caution_tag then
    raise exception using errcode = '22023', message = '"주의" 태그가 없는 음식입니다';
  end if;

  update public.foods f
  set
    caution_tag = false,
    caution_since = null,
    reaction_date = null,
    symptom_note = null,
    check_note = null
  where f.id = existing.id
  returning * into updated;

  insert into public.food_status_history (
    owner_id, food_id, from_status, to_status, caution_tag, trigger, reason,
    reaction_date, symptom_note, check_note
  )
  values (
    uid, existing.id, existing.status, existing.status, false, 'manual', clear_caution_tag.reason,
    existing.reaction_date, existing.symptom_note, existing.check_note
  );

  return updated;
end;
$$;

comment on function public.clear_caution_tag(uuid, text) is
  '"주의" 태그 해제 + 이력(알러지·주의 정보 포함) (FR-FOOD-13, BR-11, BR-13, R49). security definer (D10)';

-- 로그인한 사용자만 호출할 수 있다 (Supabase는 새 함수를 anon에게도 열어 두므로 뺀다)
revoke execute on function public.set_food_caution(uuid, date, date, text, text, text) from public, anon;
grant execute on function public.set_food_caution(uuid, date, date, text, text, text) to authenticated;
revoke execute on function public.release_food_caution(uuid, text) from public, anon;
grant execute on function public.release_food_caution(uuid, text) to authenticated;
revoke execute on function public.clear_caution_tag(uuid, text) from public, anon;
grant execute on function public.clear_caution_tag(uuid, text) to authenticated;
