import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type {
  ConstructionObject,
  ObjectInput,
  ObjectListItem,
  PersonRef,
  StatusHistoryEntry,
  Task,
  TaskInput,
  TaskStatus,
} from './types'

export class ApiError extends Error {}

function toApiError(error: PostgrestError): ApiError {
  const msg = error.message ?? ''
  if (msg.startsWith('permission denied') || msg.includes('row-level security')) {
    return new ApiError('Недостаточно прав для этого действия')
  }
  if (msg.includes('violates foreign key constraint')) {
    return new ApiError('Связанная запись не найдена или используется')
  }
  if (msg.includes('Failed to fetch')) {
    return new ApiError('Нет связи с сервером')
  }
  return new ApiError(msg || 'Неизвестная ошибка')
}

function unwrap<T>(result: { data: T | null; error: PostgrestError | null }): T {
  if (result.error) throw toApiError(result.error)
  return result.data as T
}

// RLS не возвращает ошибку, если строка недоступна, а просто ничего не меняет.
function ensureAffected(rows: unknown[] | null) {
  if (!rows || rows.length === 0) {
    throw new ApiError('Запись не найдена или недостаточно прав')
  }
}

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  return String(e)
}

const TASK_SELECT = `
  id, object_id, title, description, status, assignee_id, author_id, created_at, updated_at,
  object:objects(id, name),
  assignee:profiles!tasks_assignee_id_fkey(id, full_name),
  author:profiles!tasks_author_id_fkey(id, full_name)
`

// ---------- Объекты ----------

export async function listObjects(): Promise<ObjectListItem[]> {
  return unwrap(
    await supabase
      .from('objects')
      .select('id, name, address, created_at, tasks(status)')
      .order('name')
      .returns<ObjectListItem[]>(),
  )
}

export async function getObject(id: string): Promise<ConstructionObject | null> {
  return unwrap(
    await supabase
      .from('objects')
      .select('id, name, address, created_at')
      .eq('id', id)
      .maybeSingle<ConstructionObject>(),
  )
}

export async function createObject(input: ObjectInput): Promise<string> {
  const row = unwrap(await supabase.from('objects').insert(input).select('id').single<{ id: string }>())
  return row.id
}

export async function updateObject(id: string, input: ObjectInput): Promise<void> {
  ensureAffected(unwrap(await supabase.from('objects').update(input).eq('id', id).select('id')))
}

export async function deleteObject(id: string): Promise<void> {
  ensureAffected(unwrap(await supabase.from('objects').delete().eq('id', id).select('id')))
}

// ---------- Задачи ----------

export async function listTasks(filter: { objectId?: string } = {}): Promise<Task[]> {
  let query = supabase.from('tasks').select(TASK_SELECT).order('created_at', { ascending: false })
  if (filter.objectId) query = query.eq('object_id', filter.objectId)
  return unwrap(await query.returns<Task[]>())
}

export async function getTask(id: string): Promise<Task | null> {
  return unwrap(await supabase.from('tasks').select(TASK_SELECT).eq('id', id).maybeSingle<Task>())
}

export async function createTask(input: TaskInput): Promise<string> {
  const row = unwrap(await supabase.from('tasks').insert(input).select('id').single<{ id: string }>())
  return row.id
}

export async function updateTask(id: string, input: TaskInput): Promise<void> {
  ensureAffected(unwrap(await supabase.from('tasks').update(input).eq('id', id).select('id')))
}

export async function deleteTask(id: string): Promise<void> {
  ensureAffected(unwrap(await supabase.from('tasks').delete().eq('id', id).select('id')))
}

export async function changeTaskStatus(taskId: string, newStatus: TaskStatus, comment?: string): Promise<void> {
  unwrap(
    await supabase.rpc('change_task_status', {
      p_task_id: taskId,
      p_new_status: newStatus,
      p_comment: comment?.trim() || null,
    }),
  )
}

export async function getTaskHistory(taskId: string): Promise<StatusHistoryEntry[]> {
  return unwrap(
    await supabase
      .from('task_status_history')
      .select('id, from_status, to_status, comment, created_at, changed_by_profile:profiles(full_name)')
      .eq('task_id', taskId)
      .order('id')
      .returns<StatusHistoryEntry[]>(),
  )
}

// ---------- Пользователи ----------

export async function listExecutors(): Promise<PersonRef[]> {
  return unwrap(
    await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'executor')
      .order('full_name')
      .returns<PersonRef[]>(),
  )
}
