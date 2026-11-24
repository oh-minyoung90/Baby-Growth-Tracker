-- 작은 JSON 검증 쿼리를 테이블별로 반복하는 복원은 JIT 준비 비용을 피한다.
-- 함수 실행 동안만 적용하고 DB/역할 전체의 시간 제한·설정은 변경하지 않는다.
alter function public.import_backup(jsonb) set jit = off;
