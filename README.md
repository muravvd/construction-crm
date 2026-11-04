# СтройCRM — объекты и задачи

Мини-CRM для строительной компании: постановщики ведут объекты (стройки) и задачи, исполнители берут задачи в работу и отдают на проверку.

- **Приложение:** https://construction-crm-041126.netlify.app/
- **Стек:** React 19 + TypeScript, Vite, Ant Design, Supabase (PostgreSQL, Auth, RLS)
- [Объяснение для руководителя](docs/EXPLANATION.md)
- [Решения и допущения](docs/DECISIONS.md)

## Тестовые доступы

| Роль        | Email                     | Имя                    |
|-------------|---------------------------|------------------------|
| Постановщик | `manager@stroycrm.test`   | Сергей Петрович Иванов |
| Исполнитель | `executor1@stroycrm.test` | Алексей Смирнов        |
| Исполнитель | `executor2@stroycrm.test` | Дмитрий Кузнецов       |

Пароль передаётся вместе со ссылкой на приложение и в репозиторий не попадает.

Для проверки разграничения прав: у первого исполнителя задачи на двух объектах, у второго — на всех трёх. Поэтому «Склад на Промышленной» первый исполнитель не видит.

## Как устроено

Браузер обращается напрямую к Supabase с публичным ключом, а все права проверяет сама база данных:

- **GRANT** определяет, что вообще можно делать с таблицей. Например, у задачи через API нельзя записать поля `status`, `author_id` и `created_at`, а историю статусов можно только читать.
- **RLS** (Row Level Security) определяет, какие строки видны и изменяемы. Исполнитель видит только задачи, где он назначен, историю этих задач и объекты, в которых у него есть задачи. Создавать, менять и удалять объекты и задачи может только постановщик.
- **`change_task_status()`** — единственный способ сменить статус. Функция проверяет роль, исполнителя задачи, допустимость перехода и комментарий, а затем записывает историю.
- **Триггеры** запрещают менять статус в обход функции, ставить исполнителем не-исполнителя и изменять записи истории (даже администратору в SQL Editor).

Миграция базы — [`supabase/migrations/0001_schema.sql`](supabase/migrations/0001_schema.sql), тестовые данные — [`supabase/seed.sql`](supabase/seed.sql).

## Как запустить

Нужен Node.js 20+ и бесплатный проект на [supabase.com](https://supabase.com).

1. **Supabase:**
   - В **Authentication → Sign In / Providers** выключите **Allow new users to sign up**.
   - В **SQL Editor** выполните `0001_schema.sql`.
   - В **Authentication → Users → Add user** создайте трёх пользователей из таблицы выше с галочкой **Auto Confirm User**.
   - Выполните `seed.sql`.
2. **Приложение:**
   ```bash
   cp .env.example .env.local   # Project URL и Publishable key из Project Settings → API Keys
   npm install
   npm run dev                  # http://localhost:5173
   ```
3. **Проверки безопасности:**
   ```bash
   npm run test:db              # схема и права во встроенном PostgreSQL, без Supabase
   cp .env.test.example .env.test.local   # пароли тестовых пользователей
   npm run security-check       # запросы к живому Supabase в обход интерфейса
   ```
4. **Netlify:** импортировать репозиторий (настройки сборки берутся из `netlify.toml`) и задать переменные `VITE_SUPABASE_URL` и `VITE_SUPABASE_PUBLISHABLE_KEY`.

Постановщика назначают в SQL Editor: `update public.profiles set role = 'manager' where id = (select id from auth.users where email = '...');`
