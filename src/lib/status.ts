import type { Profile, Task, TaskStatus } from './types'

export const STATUS_LABELS: Record<TaskStatus, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  review: 'На проверке',
  accepted: 'Принята',
  rework: 'На доработке',
}

export const STATUS_COLORS: Record<TaskStatus, string> = {
  new: 'blue',
  in_progress: 'gold',
  review: 'purple',
  accepted: 'green',
  rework: 'red',
}

export const STATUS_ORDER: TaskStatus[] = ['new', 'in_progress', 'review', 'rework', 'accepted']

export interface StatusAction {
  to: TaskStatus
  label: string
  commentRequired: boolean
  danger?: boolean
}

// Только для отображения кнопок. Настоящая проверка — в функции change_task_status в базе.
export function availableActions(task: Task, profile: Profile): StatusAction[] {
  if (profile.role === 'manager') {
    if (task.status === 'review') {
      return [
        { to: 'accepted', label: 'Принять', commentRequired: false },
        { to: 'rework', label: 'Вернуть на доработку', commentRequired: true, danger: true },
      ]
    }
    return []
  }

  if (task.assignee_id !== profile.id) return []

  switch (task.status) {
    case 'new':
      return [{ to: 'in_progress', label: 'Взять в работу', commentRequired: false }]
    case 'in_progress':
      return [{ to: 'review', label: 'Отправить на проверку', commentRequired: false }]
    case 'rework':
      return [{ to: 'in_progress', label: 'Взять в работу', commentRequired: false }]
    default:
      return []
  }
}
