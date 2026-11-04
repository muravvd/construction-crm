// Локальная проверка схемы без Supabase: встроенный PostgreSQL (PGlite)
// с заглушками auth.users / auth.uid() и ролей anon / authenticated.
// Запуск: npm run test:db
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const db = new PGlite()

// Заглушки того, что в Supabase уже есть. Худший случай: «expose new tables» включён.
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
  create schema auth;
  grant usage on schema auth to anon, authenticated;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $$;
  grant execute on function auth.uid() to anon, authenticated;
`)

await db.exec(readFileSync(`${root}/migrations/0001_schema.sql`, 'utf8'))
await db.exec(`insert into auth.users (email) values ('manager@stroycrm.test'), ('executor1@stroycrm.test'), ('executor2@stroycrm.test')`)
await db.exec(readFileSync(`${root}/seed.sql`, 'utf8'))

const ids = Object.fromEntries((await db.query(`select email, id from auth.users`)).rows.map(r => [r.email.split('@')[0], r.id]))

let failed = 0
async function as(user) {
  await db.exec(`reset role`)
  if (user === 'anon') { await db.exec(`select set_config('request.jwt.claims', '', false); set role anon`); return }
  await db.exec(`select set_config('request.jwt.claims', '${JSON.stringify({ sub: ids[user], role: 'authenticated' })}', false); set role authenticated`)
}
async function expectOk(name, sql, check) {
  try {
    const r = await db.query(sql)
    if (check && !check(r)) { failed++; console.log('FAIL', name, JSON.stringify(r.rows), 'affected', r.affectedRows) }
    else console.log('ok  ', name)
  } catch (e) { failed++; console.log('FAIL', name, e.message) }
}
async function expectErr(name, sql) {
  try { const r = await db.query(sql); failed++; console.log('FAIL (no error)', name, JSON.stringify(r.rows), r.affectedRows) }
  catch (e) { console.log('ok  ', name, '->', e.message) }
}

await as('postgres')
await db.exec('reset role')
console.log((await db.query(`select t.title, t.status, p.full_name from public.tasks t join public.profiles p on p.id = t.assignee_id order by t.created_at`)).rows)
console.log('history rows:', (await db.query(`select count(*)::int n from public.task_status_history`)).rows[0].n)

const t = async (title) => (await (db.exec('reset role'), db.query(`select id from public.tasks where title = $1`, [title]))).rows[0].id
const T = {
  newEx1: await t('Залить фундамент секции А'),
  inWorkEx1: await t('Монтаж опалубки 3-го этажа'),
  reviewEx2: await t('Армирование плиты перекрытия'),
  reworkEx1: await t('Установка окон'),
  newEx2: await t('Демонтаж старой кровли'),
}

console.log('\n--- anon')
await as('anon')
await expectErr('anon select tasks', `select * from public.tasks`)
await expectErr('anon rpc', `select public.change_task_status('${T.newEx1}', 'in_progress')`)

console.log('\n--- executor1')
await as('executor1')
await expectOk('sees only own tasks', `select assignee_id from public.tasks`, r => r.rows.length === 3 && r.rows.every(x => x.assignee_id === ids.executor1))
await expectOk('sees 2 objects', `select name from public.objects`, r => r.rows.length === 2)
await expectOk('cannot see other task by id', `select * from public.tasks where id = '${T.reviewEx2}'`, r => r.rows.length === 0)
await expectOk('history only own tasks', `select distinct task_id from public.task_status_history`, r => r.rows.length === 3)
await expectErr('direct status update', `update public.tasks set status = 'accepted' where id = '${T.newEx1}'`)
await expectOk('title update affects 0 rows', `update public.tasks set title = 'x' where id = '${T.newEx1}'`, r => r.affectedRows === 0)
await expectErr('insert task', `insert into public.tasks (object_id, title, assignee_id) select object_id, 'x', assignee_id from public.tasks limit 1`)
await expectErr('insert object', `insert into public.objects (name, address) values ('x', 'y')`)
await expectOk('delete object affects 0', `delete from public.objects`, r => r.affectedRows === 0)
await expectErr('insert history', `insert into public.task_status_history (task_id, to_status, changed_by) values ('${T.newEx1}', 'accepted', '${ids.executor1}')`)
await expectErr('update history', `update public.task_status_history set comment = 'x'`)
await expectErr('delete history', `delete from public.task_status_history`)
await expectErr('change own role', `update public.profiles set role = 'manager' where id = '${ids.executor1}'`)
await expectErr('forbidden transition new->accepted', `select public.change_task_status('${T.newEx1}', 'accepted')`)
await expectErr('forbidden transition new->review', `select public.change_task_status('${T.newEx1}', 'review')`)
await expectErr('other executor task', `select public.change_task_status('${T.newEx2}', 'in_progress')`)
await expectErr('private trigger fn', `select private.tasks_after_insert()`)
await expectOk('new->in_progress', `select public.change_task_status('${T.newEx1}', 'in_progress')`)
await expectOk('in_progress->review', `select public.change_task_status('${T.inWorkEx1}', 'review', 'готово')`)
await expectOk('rework->in_progress', `select public.change_task_status('${T.reworkEx1}', 'in_progress')`)
await expectErr('executor cannot accept', `select public.change_task_status('${T.inWorkEx1}', 'accepted')`)

console.log('\n--- manager')
await as('manager')
await expectOk('sees all tasks', `select * from public.tasks`, r => r.rows.length === 7)
await expectOk('sees all objects', `select * from public.objects`, r => r.rows.length === 3)
await expectErr('rework without comment', `select public.change_task_status('${T.reviewEx2}', 'rework', '   ')`)
await expectErr('manager new->in_progress', `select public.change_task_status('${T.newEx2}', 'in_progress')`)
await expectErr('direct status update', `update public.tasks set status = 'accepted' where id = '${T.reviewEx2}'`)
await expectErr('insert task with status', `insert into public.tasks (object_id, title, assignee_id, status) select object_id, 'x', assignee_id, 'accepted' from public.tasks limit 1`)
await expectErr('assign to manager', `update public.tasks set assignee_id = '${ids.manager}' where id = '${T.newEx2}'`)
await expectOk('edit task fields', `update public.tasks set title = 'Демонтаж кровли', assignee_id = '${ids.executor1}' where id = '${T.newEx2}'`, r => r.affectedRows === 1)
await expectOk('review->accepted', `select public.change_task_status('${T.reviewEx2}', 'accepted')`)
await expectErr('insert history', `insert into public.task_status_history (task_id, to_status, changed_by) values ('${T.newEx1}', 'accepted', '${ids.manager}')`)
await expectErr('delete history', `delete from public.task_status_history`)
await expectOk('create task', `insert into public.tasks (object_id, title, assignee_id) select object_id, 'Новая тестовая', '${ids.executor2}' from public.tasks limit 1 returning status, author_id`, r => r.rows[0].status === 'new' && r.rows[0].author_id === ids.manager)
await expectOk('delete task (history cascades)', `delete from public.tasks where id = '${T.newEx2}'`, r => r.affectedRows === 1)

console.log('\n--- executor1 after reassignment')
await as('executor1')
await expectOk('now sees 3rd object', `select * from public.objects`, r => r.rows.length === 2)

await db.exec('reset role')
console.log((await db.query(`select t.title, h.from_status, h.to_status, p.full_name, h.comment from public.task_status_history h join public.tasks t on t.id = h.task_id join public.profiles p on p.id = h.changed_by where t.title = 'Установка окон' order by h.id`)).rows)
await expectErr('superuser cannot edit history', `update public.task_status_history set comment = 'x'`)

console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED')
process.exit(failed ? 1 : 0)
