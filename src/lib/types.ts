export type UserRole = 'manager' | 'executor'

export type TaskStatus = 'new' | 'in_progress' | 'review' | 'accepted' | 'rework'

export interface Profile {
  id: string
  full_name: string
  role: UserRole
}

export interface PersonRef {
  id: string
  full_name: string
}

export interface ConstructionObject {
  id: string
  name: string
  address: string
  created_at: string
}

export interface ObjectListItem extends ConstructionObject {
  tasks: { status: TaskStatus }[]
}

export interface Task {
  id: string
  object_id: string
  title: string
  description: string
  status: TaskStatus
  assignee_id: string
  author_id: string
  created_at: string
  updated_at: string
  object: { id: string; name: string } | null
  assignee: PersonRef | null
  author: PersonRef | null
}

export interface TaskInput {
  object_id: string
  title: string
  description: string
  assignee_id: string
}

export interface ObjectInput {
  name: string
  address: string
}

export interface StatusHistoryEntry {
  id: number
  from_status: TaskStatus | null
  to_status: TaskStatus
  comment: string | null
  created_at: string
  changed_by_profile: { full_name: string } | null
}
