-- 백업 검사를 테이블별 집계로 처리해 많은 항목에서도 행별 SQL·JSON 누적 복사를 줄인다.
create or replace function public.import_backup(payload jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); source_uid uuid;
  table_names text[] := ARRAY['children', 'body_measures', 'milestones', 'sleep_logs', 'foods', 'photos', 'recipes', 'recipe_ingredients', 'meal_entries', 'meal_entry_foods', 'meal_entry_recipes', 'food_status_history'];
  table_name text; field_schema jsonb; fk_targets jsonb;
  columns_sql text; allowed text[]; rows jsonb; data_rows jsonb;
  id_maps jsonb := '{}'::jsonb; map_values jsonb;
  result_rows jsonb; total_rows integer := 0;
begin
  if uid is null then raise exception using errcode='42501', message='로그인이 필요합니다'; end if;
  if payload is null or jsonb_typeof(payload) <> 'object' or payload->'schema_version' <> '1'::jsonb then
    if jsonb_typeof(payload->'schema_version') = 'number' and (payload->>'schema_version')::numeric > 1 then
      raise exception using errcode='22023', message='backup_newer_version';
    end if;
    raise exception using errcode='22023', message='backup_invalid';
  end if;
  if pg_column_size(payload) > 10485760 then raise exception using errcode='22023', message='backup_size'; end if;
  begin
    if (select count(*) from jsonb_object_keys(payload)) <> 4
      or not (payload ?& ARRAY['schema_version','exported_at','source_owner_id','data'])
      or jsonb_typeof(payload->'data') <> 'object'
      or (select count(*) from jsonb_object_keys(payload->'data')) <> cardinality(table_names)
      or not ((payload->'data') ?& table_names)
      or jsonb_typeof(payload->'exported_at') <> 'string'
      or (payload->>'exported_at')::timestamptz is null then
      raise exception 'invalid';
    end if;
    source_uid := (payload->>'source_owner_id')::uuid;
    if source_uid is null then raise exception 'invalid'; end if;
    data_rows := payload->'data';
    -- 복원 중 다른 쓰기가 끼어들지 않게 한다. 행 단위 RLS 우회는 본인 owner_id로만 한정한다.
    perform pg_advisory_xact_lock(hashtextextended('meal:' || uid::text, 0));
    lock table public.children, public.body_measures, public.milestones, public.sleep_logs,
      public.foods, public.photos, public.recipes, public.recipe_ingredients, public.meal_entries,
      public.meal_entry_foods, public.meal_entry_recipes, public.food_status_history in exclusive mode;
    foreach table_name in array table_names loop
      rows := data_rows->table_name;
      if jsonb_typeof(rows) <> 'array' then raise exception 'invalid'; end if;
      total_rows := total_rows + jsonb_array_length(rows);
      if total_rows > 20000 then raise exception 'size'; end if;
      select array_agg(a.attname::text order by a.attnum),
        jsonb_object_agg(a.attname, jsonb_build_object('required', a.attnotnull, 'type',
          case when t.typname='bool' then 'boolean' when t.typcategory='N' then 'number'
            when t.typname='jsonb' then 'array' else 'string' end))
        into allowed, field_schema
      from pg_catalog.pg_attribute a join pg_catalog.pg_type t on t.oid=a.atttypid
      where a.attrelid=('public.' || table_name)::regclass and a.attnum>0
        and not a.attisdropped and a.attgenerated='' and a.attname<>'owner_id';
      if exists (select 1 from jsonb_array_elements(rows) r where case
        when jsonb_typeof(r)<>'object' then true else not (r ?& allowed)
          or (select count(*) from jsonb_object_keys(r)) <> cardinality(allowed) end) then raise exception 'invalid'; end if;
      if exists (select 1 from jsonb_array_elements(rows) r cross join jsonb_each(field_schema) f
        where case when r->f.key='null'::jsonb then (f.value->>'required')::boolean
          else jsonb_typeof(r->f.key) <> f.value->>'type' end) then raise exception 'invalid'; end if;
      if (select count(distinct (r->>'id')::uuid) from jsonb_array_elements(rows) r) <> jsonb_array_length(rows) then raise exception 'invalid'; end if;
      if table_name='photos' and exists (select 1 from jsonb_array_elements(rows) r
        where r->>'storage_path' <> source_uid::text || '/' || ((r->>'id')::uuid)::text || '.jpg') then raise exception 'invalid'; end if;
      -- 행마다 SQL·JSON 누적 복사를 반복하지 않고 ID 충돌을 한 번의 집계로 처리한다.
      execute format('select coalesce(jsonb_object_agg(((r->>''id'')::uuid)::text,
        case when existing.id is null then (r->>''id'')::uuid else gen_random_uuid() end), ''{}''::jsonb)
        from jsonb_array_elements($1) r left join public.%I existing
          on existing.id=(r->>''id'')::uuid and existing.owner_id<>$2', table_name)
        into map_values using rows, uid;
      id_maps := id_maps || jsonb_build_object(table_name, map_values);
    end loop;
    if exists (select 1 from jsonb_array_elements(data_rows->'sleep_logs') r
      cross join lateral jsonb_array_elements(r->'naps') nap where case when jsonb_typeof(nap)<>'object' then true else
        not (nap ?& ARRAY['start','end']) or (select count(*) from jsonb_object_keys(nap))<>2
        or jsonb_typeof(nap->'start')<>'string' or jsonb_typeof(nap->'end')<>'string' end) then raise exception 'invalid'; end if;
    if jsonb_array_length(data_rows->'children') > 1 or
      (jsonb_array_length(data_rows->'children') = 0 and total_rows > 0) then raise exception 'invalid'; end if;
    -- 참조는 같은 파일 안으로만 제한한다. 타인 ID와 충돌할 때만 재발급하고 연결도 함께 바꾼다.
    foreach table_name in array table_names loop
      select coalesce(jsonb_object_agg(source_column,target_table),'{}'::jsonb) into fk_targets from (values
          ('recipes','photo_id','photos'),
          ('recipe_ingredients','recipe_id','recipes'),
          ('recipe_ingredients','food_id','foods'),
          ('meal_entry_foods','meal_entry_id','meal_entries'),
          ('meal_entry_foods','food_id','foods'),
          ('meal_entry_recipes','meal_entry_id','meal_entries'),
          ('meal_entry_recipes','recipe_id','recipes'),
          ('food_status_history','food_id','foods'),
          ('food_status_history','meal_entry_id','meal_entries')
      ) x(source_table, source_column, target_table) where source_table=table_name;
      if exists (select 1 from jsonb_array_elements(data_rows->table_name) r
        cross join jsonb_each_text(fk_targets) fk where r->>fk.key is not null
          and not ((id_maps->fk.value) ? (((r->>fk.key)::uuid)::text))) then raise exception 'invalid'; end if;
      select coalesce(jsonb_agg(r.value || jsonb_build_object('id',id_maps->table_name->(((r.value->>'id')::uuid)::text))
        || coalesce((select jsonb_object_agg(fk.key,case when r.value->>fk.key is null then 'null'::jsonb
          else id_maps->fk.value->(((r.value->>fk.key)::uuid)::text) end) from jsonb_each_text(fk_targets) fk),'{}'::jsonb)
        || case when table_name='photos' then jsonb_build_object('storage_path',uid::text || '/' ||
          (id_maps->table_name->>(((r.value->>'id')::uuid)::text)) || '.jpg') else '{}'::jsonb end
        order by r.ordinality),'[]'::jsonb) into result_rows
      from jsonb_array_elements(data_rows->table_name) with ordinality r(value,ordinality);
      data_rows := jsonb_set(data_rows, ARRAY[table_name], result_rows);
    end loop;
    -- 자식→부모 순으로 본인 데이터만 지운다. Storage 실제 파일은 유지한다.
    foreach table_name in array ARRAY['food_status_history','meal_entry_foods','meal_entry_recipes','meal_entries','recipe_ingredients','recipes','photos','foods','sleep_logs','milestones','body_measures','children'] loop
      execute format('delete from public.%I where owner_id=$1', table_name) using uid;
    end loop;
    -- 아이 정보 수정 뒤에도 남아 있는 생년월일 이전 기록을 보존한다.
    -- 아이 정보는 마지막에 원래 값으로 넣고 검증·RLS·타임스탬프 트리거는 비활성화하지 않는다.
    foreach table_name in array ARRAY['body_measures','milestones','sleep_logs','foods','photos','recipes','recipe_ingredients','meal_entries','meal_entry_foods','meal_entry_recipes','food_status_history','children'] loop
      select string_agg(format('%I', a.attname), ', ' order by a.attnum) into columns_sql
      from pg_catalog.pg_attribute a where a.attrelid = ('public.' || table_name)::regclass
        and a.attnum > 0 and not a.attisdropped and a.attgenerated = '' and a.attname <> 'owner_id';
      execute format('insert into public.%I (%s, owner_id) select %s, $2 from jsonb_populate_recordset(null::public.%I, $1)', table_name, columns_sql, columns_sql, table_name)
        using data_rows->table_name, uid;
    end loop;
  exception when others then
    -- 예외 블록 전체가 롤백된다. 레코드 값이 포함된 DB 상세 오류는 노출하지 않는다.
    if sqlerrm='size' then raise exception using errcode='22023', message='backup_size'; end if;
    raise exception using errcode='22023', message='backup_invalid';
  end;
end;
$$;
revoke all on function public.import_backup(jsonb) from public, anon;
grant execute on function public.import_backup(jsonb) to authenticated;
