-- Тестовые данные. Выполнять в SQL Editor после 0001_schema.sql.
--
-- Сначала создайте трёх пользователей в Authentication → Users → Add user → Create new user
-- (галочка «Auto Confirm User»):
--   manager@stroycrm.test    — постановщик
--   executor1@stroycrm.test  — исполнитель
--   executor2@stroycrm.test  — исполнитель
--
-- Задачи создаются и проводятся по статусам через те же функции, что и в приложении
-- (от имени нужного пользователя), поэтому история получается настоящей.

do $$
declare
  v_manager uuid;
  v_ex1     uuid;
  v_ex2     uuid;
  v_obj1    uuid;
  v_obj2    uuid;
  v_obj3    uuid;
  v_t       uuid;
begin
  select id into v_manager from auth.users where email = 'manager@stroycrm.test';
  select id into v_ex1     from auth.users where email = 'executor1@stroycrm.test';
  select id into v_ex2     from auth.users where email = 'executor2@stroycrm.test';

  if v_manager is null or v_ex1 is null or v_ex2 is null then
    raise exception 'Сначала создайте пользователей manager@, executor1@, executor2@stroycrm.test';
  end if;

  if exists (select 1 from public.objects) then
    raise notice 'Объекты уже есть, тестовые данные не добавлены';
    return;
  end if;

  insert into public.profiles (id, full_name, role) values
    (v_manager, 'Сергей Петрович Иванов', 'manager'),
    (v_ex1,     'Алексей Смирнов',        'executor'),
    (v_ex2,     'Дмитрий Кузнецов',       'executor')
  on conflict (id) do update set full_name = excluded.full_name, role = excluded.role;

  -- Действуем от имени постановщика: создаём объекты и задачи.
  perform set_config('request.jwt.claims', json_build_object('sub', v_manager, 'role', 'authenticated')::text, true);

  insert into public.objects (name, address) values ('ЖК «Северный», корпус 2', 'г. Москва, ул. Полярная, 15')
    returning id into v_obj1;
  insert into public.objects (name, address) values ('Коттедж в Сосновке', 'Московская обл., пос. Сосновка, ул. Лесная, 7')
    returning id into v_obj2;
  insert into public.objects (name, address) values ('Склад на Промышленной', 'г. Подольск, ул. Промышленная, 3, стр. 1')
    returning id into v_obj3;

  -- 1. Новая
  insert into public.tasks (object_id, title, description, assignee_id) values
    (v_obj1, 'Залить фундамент секции А', 'Бетон М300, приёмка арматуры до заливки.', v_ex1);

  -- 2. В работе
  insert into public.tasks (object_id, title, description, assignee_id) values
    (v_obj1, 'Монтаж опалубки 3-го этажа', 'Опалубка щитовая, проверить вертикаль.', v_ex1)
    returning id into v_t;
  perform set_config('request.jwt.claims', json_build_object('sub', v_ex1, 'role', 'authenticated')::text, true);
  perform public.change_task_status(v_t, 'in_progress');

  -- 3. На проверке
  perform set_config('request.jwt.claims', json_build_object('sub', v_manager, 'role', 'authenticated')::text, true);
  insert into public.tasks (object_id, title, description, assignee_id) values
    (v_obj1, 'Армирование плиты перекрытия', 'Шаг арматуры 200 мм, фотоотчёт обязателен.', v_ex2)
    returning id into v_t;
  perform set_config('request.jwt.claims', json_build_object('sub', v_ex2, 'role', 'authenticated')::text, true);
  perform public.change_task_status(v_t, 'in_progress');
  perform public.change_task_status(v_t, 'review', 'Армирование выполнено, фото приложены в чат объекта.');

  -- 4. Принята
  perform set_config('request.jwt.claims', json_build_object('sub', v_manager, 'role', 'authenticated')::text, true);
  insert into public.tasks (object_id, title, description, assignee_id) values
    (v_obj2, 'Кладка стен первого этажа', 'Газобетон D500, толщина 375 мм.', v_ex2)
    returning id into v_t;
  perform set_config('request.jwt.claims', json_build_object('sub', v_ex2, 'role', 'authenticated')::text, true);
  perform public.change_task_status(v_t, 'in_progress');
  perform public.change_task_status(v_t, 'review');
  perform set_config('request.jwt.claims', json_build_object('sub', v_manager, 'role', 'authenticated')::text, true);
  perform public.change_task_status(v_t, 'accepted', 'Принято, геометрия в норме.');

  -- 5. На доработке
  insert into public.tasks (object_id, title, description, assignee_id) values
    (v_obj2, 'Установка окон', 'ПВХ-окна, 6 шт. Монтаж по ГОСТ 30971.', v_ex1)
    returning id into v_t;
  perform set_config('request.jwt.claims', json_build_object('sub', v_ex1, 'role', 'authenticated')::text, true);
  perform public.change_task_status(v_t, 'in_progress');
  perform public.change_task_status(v_t, 'review');
  perform set_config('request.jwt.claims', json_build_object('sub', v_manager, 'role', 'authenticated')::text, true);
  perform public.change_task_status(v_t, 'rework', 'Не заделаны монтажные швы снаружи, переделать.');

  -- 6. Новая (объект 3 — только у второго исполнителя)
  insert into public.tasks (object_id, title, description, assignee_id) values
    (v_obj3, 'Демонтаж старой кровли', 'Вывоз мусора — контейнер 27 м³.', v_ex2);

  -- 7. В работе после доработки
  insert into public.tasks (object_id, title, description, assignee_id) values
    (v_obj3, 'Подвод электричества', 'Кабель ВВГнг 5×10, щит учёта на фасаде.', v_ex2)
    returning id into v_t;
  perform set_config('request.jwt.claims', json_build_object('sub', v_ex2, 'role', 'authenticated')::text, true);
  perform public.change_task_status(v_t, 'in_progress');
  perform public.change_task_status(v_t, 'review');
  perform set_config('request.jwt.claims', json_build_object('sub', v_manager, 'role', 'authenticated')::text, true);
  perform public.change_task_status(v_t, 'rework', 'Нет акта скрытых работ по траншее.');
  perform set_config('request.jwt.claims', json_build_object('sub', v_ex2, 'role', 'authenticated')::text, true);
  perform public.change_task_status(v_t, 'in_progress');

  perform set_config('request.jwt.claims', '', true);
end;
$$;
