import { Tag } from 'antd'
import { STATUS_COLORS, STATUS_LABELS } from '../lib/status'
import type { TaskStatus } from '../lib/types'

export function StatusTag({ status }: { status: TaskStatus }) {
  return <Tag color={STATUS_COLORS[status]}>{STATUS_LABELS[status]}</Tag>
}
