// Проверка правил доступа «в обход интерфейса»: прямые запросы к Supabase
// с публичным ключом, как это мог бы сделать пользователь из консоли браузера.
//
// Запуск: npm run security-check
// Нужны переменные (например, в .env.test.local):
//   MANAGER_EMAIL, MANAGER_PASSWORD, EXECUTOR_EMAIL, EXECUTOR_PASSWORD
//
// Все проверки ожидают отказа, данные в базе не меняются.

import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
const required = ['MANAGER_EMAIL', 'MANAGER_PASSWORD', 'EXECUTOR_EMAIL', 'EXECUTOR_PASSWORD']
const missing = required.filter((name) => !process.env[name])
if (!url || !key || missing.length) {
  console.error('Не заданы переменные:', [!url && 'VITE_SUPABASE_URL', !key && 'VITE_SUPABASE_PUBLISHABLE_KEY', ...missing].filter(Boolean).join(', '))
  process.exit(1)
}

const client = () => createClient(url, key, { auth: { persistSession: false } })

async function login(email, password) {
  const c = client()
  const { data, error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`Не удалось войти как ${email}: ${error.message}`)
  return { c, userId: data.user.id }
}

let failed = 0
function check(name, ok, details = '') {
  if (!ok) failed++
  console.log(`${ok ? 'OK  ' : 'FAIL'}  ${name}${details ? `  (${details})` : ''}`)
}
// Запрос «не прошёл», если вернул ошибку или не затронул ни одной строки.
function denied({ error, data }) {
  return !!error || (Array.isArray(data) && data.length === 0)
}
const why = (r) => r.error?.message ?? (Array.isArray(r.data) ? `строк: ${r.data.length}` : '')

const anon = client()
const manager = await login(process.env.MANAGER_EMAIL, process.env.MANAGER_PASSWORD)
const executor = await login(process.env.EXECUTOR_EMAIL, process.env.EXECUTOR_PASSWORD)

const allTasks = (await manager.c.from('tasks').select('id, object_id, status, assignee_id')).data ?? []
const ownTasks = allTasks.filter((t) => t.assignee_id === executor.userId)
const foreignTask = allTasks.find((t) => t.assignee_id !== executor.userId)
const ownTask = ownTasks.find((t) => t.status === 'new') ?? ownTasks[0]
const reviewTask = allTasks.find((t) => t.status === 'review')
if (!foreignTask || !ownTask) {
  console.error('Нужны задачи и у этого исполнителя, и у другого (запустите seed.sql)')
  process.exit(1)
}

console.log('\n— Без входа')
{
  const r = await anon.from('tasks').select('id')
  check('аноним не читает задачи', !!r.error || r.data.length === 0, why(r))
  const s = await anon.auth.signUp({ email: `intruder${Date.now()}@example.com`, password: 'Passw0rd!123456' })
  check('открытая регистрация отключена', !!s.error, s.error?.message ?? 'регистрация прошла!')
}

console.log('\n— Исполнитель')
{
  const c = executor.c
  const r = await c.from('tasks').select('id, assignee_id')
  check('видит только свои задачи', !r.error && r.data.every((t) => t.assignee_id === executor.userId),
    `видно ${r.data?.length}, своих ${ownTasks.length}`)

  const f = await c.from('tasks').select('id').eq('id', foreignTask.id)
  check('не читает чужую задачу по id', denied(f), why(f))

  const fh = await c.from('task_status_history').select('id').eq('task_id', foreignTask.id)
  check('не читает историю чужой задачи', denied(fh), why(fh))

  const u1 = await c.from('tasks').update({ status: 'accepted' }).eq('id', ownTask.id).select('id')
  check('не меняет статус своей задачи напрямую', denied(u1), why(u1))

  const u2 = await c.from('tasks').update({ title: 'взлом' }).eq('id', ownTask.id).select('id')
  check('не редактирует свою задачу', denied(u2), why(u2))

  const u3 = await c.from('tasks').update({ assignee_id: executor.userId }).eq('id', foreignTask.id).select('id')
  check('не переназначает чужую задачу на себя', denied(u3), why(u3))

  const d = await c.from('tasks').delete().eq('id', foreignTask.id).select('id')
  check('не удаляет задачи', denied(d), why(d))

  const i = await c.from('tasks').insert({ object_id: ownTask.object_id, title: 'x', assignee_id: executor.userId }).select('id')
  check('не создаёт задачи', denied(i), why(i))

  const o = await c.from('objects').insert({ name: 'x', address: 'y' }).select('id')
  check('не создаёт объекты', denied(o), why(o))

  const rpc1 = await c.rpc('change_task_status', { p_task_id: ownTask.id, p_new_status: 'accepted' })
  check('не принимает свою задачу сам (запрещённый переход)', !!rpc1.error, rpc1.error?.message)

  const rpc2 = await c.rpc('change_task_status', { p_task_id: foreignTask.id, p_new_status: 'in_progress' })
  check('не меняет статус чужой задачи', !!rpc2.error, rpc2.error?.message)

  const h1 = await c.from('task_status_history').insert({ task_id: ownTask.id, to_status: 'accepted', changed_by: executor.userId }).select('id')
  check('не добавляет записи в историю', denied(h1), why(h1))

  const h2 = await c.from('task_status_history').update({ comment: 'подделка' }).eq('task_id', ownTask.id).select('id')
  check('не изменяет историю', denied(h2), why(h2))

  const h3 = await c.from('task_status_history').delete().eq('task_id', ownTask.id).select('id')
  check('не удаляет историю', denied(h3), why(h3))

  const p = await c.from('profiles').update({ role: 'manager' }).eq('id', executor.userId).select('id')
  check('не назначает себя постановщиком', denied(p), why(p))

  const fn = await c.schema('private').rpc('is_manager')
  check('служебные функции недоступны через API', !!fn.error, fn.error?.message)
}

console.log('\n— Постановщик')
{
  const c = manager.c
  const u = await c.from('tasks').update({ status: 'accepted' }).eq('id', ownTask.id).select('id')
  check('не меняет статус напрямую, только через проверенные переходы', denied(u), why(u))

  const rpc = await c.rpc('change_task_status', { p_task_id: ownTask.id, p_new_status: 'in_progress' })
  check('не выполняет переходы исполнителя', !!rpc.error, rpc.error?.message)

  if (reviewTask) {
    const r = await c.rpc('change_task_status', { p_task_id: reviewTask.id, p_new_status: 'rework', p_comment: '  ' })
    check('не возвращает на доработку без комментария', !!r.error, r.error?.message)
  }

  const h = await c.from('task_status_history').delete().eq('task_id', ownTask.id).select('id')
  check('не удаляет историю', denied(h), why(h))
}

console.log(failed ? `\nПровалено проверок: ${failed}` : '\nВсе проверки пройдены')
process.exit(failed ? 1 : 0)
