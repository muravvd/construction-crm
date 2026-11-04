-- Мини-CRM «Объекты и задачи»: схема, правила доступа (RLS), смена статусов.
-- Выполнить целиком в Supabase Dashboard → SQL Editor.

-- Схема для служебных функций. Она не опубликована через API,
-- поэтому вызвать эти функции напрямую из браузера нельзя.
create schema if not exists private;

create type public.user_role as enum ('manager', 'executor');
create type public.task_status as enum ('new', 'in_progress', 'review', 'accepted', 'rework');

-- =========================================================================
-- Таблицы
-- =========================================================================

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text not null check (length(btrim(full_name)) > 0),
  role       public.user_role not null default 'executor',
  created_at timestamptz not null default now()
);

create table public.objects (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(btrim(name)) between 1 and 200),
  address    text not null check (length(btrim(address)) between 1 and 500),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.tasks (
  id          uuid primary key default gen_random_uuid(),
  object_id   uuid not null references public.objects (id) on delete cascade,
  title       text not null check (length(btrim(title)) between 1 and 200),
  description text not null default '' check (length(description) <= 5000),
  assignee_id uuid not null references public.profiles (id) on delete restrict,
  status      public.task_status not null default 'new',
  author_id   uuid not null references public.profiles (id) on delete restrict default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index tasks_object_id_idx on public.tasks (object_id);
create index tasks_assignee_id_idx on public.tasks (assignee_id);

create table public.task_status_history (
  id          bigint generated always as identity primary key,
  task_id     uuid not null references public.tasks (id) on delete cascade,
  from_status public.task_status,           -- null = задача создана
  to_status   public.task_status not null,
  changed_by  uuid not null references public.profiles (id) on delete restrict,
  comment     text check (comment is null or length(comment) <= 2000),
  created_at  timestamptz not null default now()
);

create index task_status_history_task_id_idx on public.task_status_history (task_id, id);

-- =========================================================================
-- Служебные функции
-- =========================================================================

-- security definer: читает profiles без учёта RLS, иначе правила
-- для profiles/tasks зациклились бы друг на друге.
create function private.is_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'manager'
  );
$$;

create function private.status_label(p_status public.task_status)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_status
    when 'new'         then 'Новая'
    when 'in_progress' then 'В работе'
    when 'review'      then 'На проверке'
    when 'accepted'    then 'Принята'
    when 'rework'      then 'На доработке'
  end;
$$;

-- Профиль создаётся автоматически при создании пользователя в Supabase Auth.
-- Роль всегда «исполнитель»: назначить постановщика можно только через SQL Editor.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Проверки при создании и изменении задачи (работают для любого источника запроса).
create function private.tasks_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'new' then
      raise exception 'Новая задача может быть создана только в статусе «Новая»' using errcode = '23514';
    end if;
  else
    if new.status is distinct from old.status
       and coalesce(current_setting('crm.status_change_allowed', true), '') <> 'on' then
      raise exception 'Статус меняется только через change_task_status' using errcode = '42501';
    end if;
    if new.author_id is distinct from old.author_id or new.created_at is distinct from old.created_at then
      raise exception 'Автор и дата создания задачи не изменяются' using errcode = '42501';
    end if;
    new.updated_at := now();
  end if;

  if (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id)
     and not exists (select 1 from public.profiles where id = new.assignee_id and role = 'executor') then
    raise exception 'Исполнителем может быть только пользователь с ролью «Исполнитель»' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger tasks_before_write
  before insert or update on public.tasks
  for each row execute function private.tasks_before_write();

-- Первая запись истории — создание задачи.
create function private.tasks_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.task_status_history (task_id, from_status, to_status, changed_by)
  values (new.id, null, new.status, new.author_id);
  return new;
end;
$$;

create trigger tasks_after_insert
  after insert on public.tasks
  for each row execute function private.tasks_after_insert();

-- Записи истории неизменяемы ни для кого, включая администратора в SQL Editor.
create function private.history_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Записи истории статусов нельзя изменять' using errcode = '42501';
end;
$$;

create trigger task_status_history_immutable
  before update on public.task_status_history
  for each row execute function private.history_immutable();

-- =========================================================================
-- Смена статуса — единственный способ поменять статус задачи
-- =========================================================================

create function public.change_task_status(
  p_task_id    uuid,
  p_new_status public.task_status,
  p_comment    text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_role    public.user_role;
  v_task    public.tasks;
  v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
  v_move    text;
begin
  if v_uid is null then
    raise exception 'Требуется вход в систему' using errcode = '42501';
  end if;

  select role into v_role from public.profiles where id = v_uid;
  if v_role is null then
    raise exception 'Профиль пользователя не найден' using errcode = '42501';
  end if;

  select * into v_task from public.tasks where id = p_task_id for update;

  -- Для исполнителя чужая задача неотличима от несуществующей.
  if not found or (v_role = 'executor' and v_task.assignee_id <> v_uid) then
    raise exception 'Задача не найдена' using errcode = 'P0002';
  end if;

  v_move := v_task.status::text || '->' || p_new_status::text;

  if not (
    (v_role = 'manager'  and v_move in ('review->accepted', 'review->rework'))
    or (v_role = 'executor' and v_move in ('new->in_progress', 'in_progress->review', 'rework->in_progress'))
  ) then
    raise exception 'Переход из статуса «%» в «%» вам недоступен',
      private.status_label(v_task.status), private.status_label(p_new_status)
      using errcode = '42501';
  end if;

  if p_new_status = 'rework' and v_comment is null then
    raise exception 'При возврате на доработку комментарий обязателен' using errcode = '23514';
  end if;

  if length(v_comment) > 2000 then
    raise exception 'Комментарий длиннее 2000 символов' using errcode = '23514';
  end if;

  perform set_config('crm.status_change_allowed', 'on', true);
  update public.tasks set status = p_new_status where id = p_task_id;
  perform set_config('crm.status_change_allowed', 'off', true);

  insert into public.task_status_history (task_id, from_status, to_status, changed_by, comment)
  values (p_task_id, v_task.status, p_new_status, v_uid, v_comment);
end;
$$;

-- =========================================================================
-- Права доступа (GRANT): что вообще можно делать с таблицей через API
-- =========================================================================

revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;

grant usage on schema private to authenticated;
grant execute on function private.is_manager() to authenticated;

grant select on public.profiles to authenticated;

grant select, delete on public.objects to authenticated;
grant insert (name, address), update (name, address) on public.objects to authenticated;

-- status, author_id, created_at нельзя записать напрямую: на них нет прав.
grant select, delete on public.tasks to authenticated;
grant insert (object_id, title, description, assignee_id),
      update (object_id, title, description, assignee_id)
  on public.tasks to authenticated;

-- История: только чтение. Записывает её только change_task_status и триггер создания.
grant select on public.task_status_history to authenticated;

grant execute on function public.change_task_status(uuid, public.task_status, text) to authenticated;

-- =========================================================================
-- RLS: какие именно строки доступны пользователю
-- =========================================================================

alter table public.profiles enable row level security;
alter table public.objects enable row level security;
alter table public.tasks enable row level security;
alter table public.task_status_history enable row level security;

-- Профили (имя и роль) видны всем сотрудникам: нужны для имён в задачах и истории.
create policy profiles_select on public.profiles
  for select to authenticated
  using (true);

create policy objects_select on public.objects
  for select to authenticated
  using (
    (select private.is_manager())
    or exists (
      select 1 from public.tasks t
      where t.object_id = objects.id and t.assignee_id = (select auth.uid())
    )
  );

create policy objects_insert on public.objects
  for insert to authenticated
  with check ((select private.is_manager()));

create policy objects_update on public.objects
  for update to authenticated
  using ((select private.is_manager()))
  with check ((select private.is_manager()));

create policy objects_delete on public.objects
  for delete to authenticated
  using ((select private.is_manager()));

create policy tasks_select on public.tasks
  for select to authenticated
  using ((select private.is_manager()) or assignee_id = (select auth.uid()));

create policy tasks_insert on public.tasks
  for insert to authenticated
  with check ((select private.is_manager()));

create policy tasks_update on public.tasks
  for update to authenticated
  using ((select private.is_manager()))
  with check ((select private.is_manager()));

create policy tasks_delete on public.tasks
  for delete to authenticated
  using ((select private.is_manager()));

create policy task_status_history_select on public.task_status_history
  for select to authenticated
  using (
    (select private.is_manager())
    or exists (
      select 1 from public.tasks t
      where t.id = task_status_history.task_id and t.assignee_id = (select auth.uid())
    )
  );
