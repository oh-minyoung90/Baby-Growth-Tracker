-- T-29·T-30: 본인 기록의 JSON 백업과 원자적 전체 복원. 사진 파일은 삭제·복사하지 않는다.
create function public.export_backup()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); result jsonb;
begin
  if uid is null then raise exception using errcode='42501', message='로그인이 필요합니다'; end if;
  -- 하나의 SELECT에서 모든 테이블을 읽어 연결 관계가 일관된 스냅샷을 만든다.
  select jsonb_build_object('schema_version', 1, 'exported_at', now(), 'source_owner_id', uid,
    'data', jsonb_build_object(
    'children', (select coalesce(jsonb_agg(to_jsonb(t) - 'owner_id' order by t.id), '[]'::jsonb) from public.children t where t.owner_id = uid),
    'body_measures', (select coalesce(jsonb_agg(to_jsonb(t) - 'owner_id' order by t.id), '[]'::jsonb) from public.body_measures t where t.owner_id = uid),
    'milestones', (select coalesce(jsonb_agg(to_jsonb(t) - 'owner_id' - 'title_key' order by t.id), '[]'::jsonb) from public.milestones t where t.owner_id = uid),
    'sleep_logs', (select coalesce(jsonb_agg(to_jsonb(t) - 'owner_id' order by t.id), '[]'::jsonb) from public.sleep_logs t where t.owner_id = uid),
    'foods', (select coalesce(jsonb_agg(to_jsonb(t) - 'owner_id' - 'name_key' order by t.id), '[]'::jsonb) from public.foods t where t.owner_id = uid),
    'photos', (select coalesce(jsonb_agg(to_jsonb(t) - 'owner_id' order by t.id), '[]'::jsonb) from public.photos t where t.owner_id = uid),
    'recipes', (select coalesce(jsonb_agg(to_jsonb(t) - 'owner_id' order by t.id), '[]'::jsonb) from public.recipes t where t.owner_id = uid),
    'recipe_ingredients', (select coalesce(jsonb_agg(to_jsonb(t) - 'owner_id' order by t.id), '[]'::jsonb) from public.recipe_ingredients t where t.owner_id = uid),
    'meal_entries', (select coalesce(jsonb_agg(to_jsonb(t) - 'owner_id' order by t.id), '[]'::jsonb) from public.meal_entries t where t.owner_id = uid),
    'meal_entry_foods', (select coalesce(jsonb_agg(to_jsonb(t) - 'owner_id' order by t.id), '[]'::jsonb) from public.meal_entry_foods t where t.owner_id = uid),
    'meal_entry_recipes', (select coalesce(jsonb_agg(to_jsonb(t) - 'owner_id' order by t.id), '[]'::jsonb) from public.meal_entry_recipes t where t.owner_id = uid),
    'food_status_history', (select coalesce(jsonb_agg(to_jsonb(t) - 'owner_id' order by t.id), '[]'::jsonb) from public.food_status_history t where t.owner_id = uid)
  )) into result;
  return result;
end;
$$;
revoke all on function public.export_backup() from public, anon;
grant execute on function public.export_backup() to authenticated;

create function public.import_backup(payload jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); source_uid uuid;
  table_names text[] := ARRAY['children', 'body_measures', 'milestones', 'sleep_logs', 'foods', 'photos', 'recipes', 'recipe_ingredients', 'meal_entries', 'meal_entry_foods', 'meal_entry_recipes', 'food_status_history'];
  table_name text; row_value jsonb; field record; expected_type text;
  columns_sql text; allowed text[]; rows jsonb; data_rows jsonb;
  id_maps jsonb := '{}'::jsonb; map_values jsonb; old_id uuid; new_id uuid; collision boolean;
  fk record; ref_id text; result_rows jsonb; total_rows integer := 0;
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
      select array_agg(a.attname::text order by a.attnum) into allowed
      from pg_catalog.pg_attribute a where a.attrelid = ('public.' || table_name)::regclass
        and a.attnum > 0 and not a.attisdropped and a.attgenerated = '' and a.attname <> 'owner_id';
      map_values := '{}'::jsonb;
      for row_value in select value from jsonb_array_elements(rows) loop
        if jsonb_typeof(row_value) <> 'object' or not (row_value ?& allowed)
          or (select count(*) from jsonb_object_keys(row_value)) <> cardinality(allowed) then raise exception 'invalid'; end if;
        -- JSON 타입도 검사해 문자열 "false" 등의 암묵적 변환을 허용하지 않는다.
        for field in select a.attname, a.attnotnull, t.typcategory, t.typname
          from pg_catalog.pg_attribute a join pg_catalog.pg_type t on t.oid = a.atttypid
          where a.attrelid = ('public.' || table_name)::regclass and a.attname = any(allowed) loop
          expected_type := case when field.typname = 'bool' then 'boolean'
            when field.typcategory = 'N' then 'number' when field.typname = 'jsonb' then 'array' else 'string' end;
          if (row_value -> (field.attname::text)) = 'null'::jsonb then
            if field.attnotnull then raise exception 'invalid'; end if;
          elsif jsonb_typeof(row_value -> (field.attname::text)) <> expected_type then
            raise exception 'invalid';
          end if;
        end loop;
        old_id := (row_value->>'id')::uuid;
        if old_id is null or map_values ? old_id::text then raise exception 'invalid'; end if;
        execute format('select exists(select 1 from public.%I where id=$1 and owner_id<>$2)', table_name)
          into collision using old_id, uid;
        new_id := case when collision then gen_random_uuid() else old_id end;
        map_values := map_values || jsonb_build_object(old_id::text, new_id);
        if table_name = 'photos' and row_value->>'storage_path' <> source_uid::text || '/' || old_id::text || '.jpg' then raise exception 'invalid'; end if;
      end loop;
      id_maps := id_maps || jsonb_build_object(table_name, map_values);
    end loop;
    if jsonb_array_length(data_rows->'children') > 1 or
      (jsonb_array_length(data_rows->'children') = 0 and total_rows > 0) then raise exception 'invalid'; end if;
    -- 참조는 같은 파일 안으로만 제한한다. 타인 ID와 충돌할 때만 재발급하고 연결도 함께 바꾼다.
    foreach table_name in array table_names loop
      result_rows := '[]'::jsonb;
      for row_value in select value from jsonb_array_elements(data_rows->table_name) loop
        old_id := (row_value->>'id')::uuid;
        row_value := row_value || jsonb_build_object('id', id_maps->table_name->>old_id::text);
        for fk in select * from (values
          ('recipes','photo_id','photos'),
          ('recipe_ingredients','recipe_id','recipes'),
          ('recipe_ingredients','food_id','foods'),
          ('meal_entry_foods','meal_entry_id','meal_entries'),
          ('meal_entry_foods','food_id','foods'),
          ('meal_entry_recipes','meal_entry_id','meal_entries'),
          ('meal_entry_recipes','recipe_id','recipes'),
          ('food_status_history','food_id','foods'),
          ('food_status_history','meal_entry_id','meal_entries')
        ) x(source_table, source_column, target_table) where x.source_table = table_name loop
          ref_id := row_value->>fk.source_column;
          if ref_id is not null then
            if not ((id_maps->fk.target_table) ? ref_id) then raise exception 'invalid'; end if;
            row_value := jsonb_set(row_value, ARRAY[fk.source_column], id_maps->fk.target_table->ref_id);
          end if;
        end loop;
        if table_name = 'photos' then row_value := jsonb_set(row_value, '{storage_path}', to_jsonb(uid::text || '/' || (row_value->>'id') || '.jpg')); end if;
        result_rows := result_rows || jsonb_build_array(row_value);
      end loop;
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
    raise exception using errcode='22023', message='backup_invalid';
  end;
end;
$$;
revoke all on function public.import_backup(jsonb) from public, anon;
grant execute on function public.import_backup(jsonb) to authenticated;
