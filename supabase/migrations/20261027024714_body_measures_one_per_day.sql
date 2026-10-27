-- T-16: 키·몸무게는 측정 날짜마다 1건만 둔다
-- 기준: 기능요구사항서 FR-BODY-06, R27 (2026-10-27 변경: 확인 후 허용 → 하루 1건)
-- 같은 날짜에 두 번째 기록을 저장하면 23505(unique_violation)로 거부된다.

alter table public.body_measures
  add constraint body_measures_owner_date_key unique (owner_id, date);

-- 위 제약이 만드는 (owner_id, date) 인덱스가 목록 조회(날짜 최신순)도 맡으므로 기존 인덱스는 지운다
drop index public.body_measures_owner_date_idx;

comment on table public.body_measures is '키·몸무게 측정 (F-05). 계정마다 측정 날짜당 1건 (FR-BODY-06)';
