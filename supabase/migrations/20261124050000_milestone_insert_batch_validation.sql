-- 대량 백업에서 발달 기록을 행마다 조회하던 중복 검사를 INSERT 문장 단위로 묶는다.
-- UPDATE는 기존 규칙(유형·내용이 그대로면 과거 중복 기록도 수정 허용)을 유지한다.
drop trigger milestones_reject_duplicate on public.milestones;
create trigger milestones_reject_duplicate
  after update on public.milestones
  for each row execute function public.reject_duplicate_milestone();

create function public.reject_duplicate_milestone_insert()
returns trigger language plpgsql set search_path = '' as $$
begin
  if exists (
    select 1 from inserted_milestones n
    join public.milestones existing
      on existing.owner_id = n.owner_id and existing.type = n.type
      and existing.title_key = n.title_key and existing.id <> n.id
  ) then
    raise exception using errcode = '23505', message = '같은 유형에 같은 내용이 이미 있습니다';
  end if;
  return null;
end;
$$;
create trigger milestones_reject_duplicate_insert
  after insert on public.milestones
  referencing new table as inserted_milestones
  for each statement execute function public.reject_duplicate_milestone_insert();
