import { Table, type TableColumnsType } from 'antd'
import { Link } from 'react-router'
import { formatDateTime } from '../lib/format'
import { STATUS_LABELS, STATUS_ORDER } from '../lib/status'
import type { Task } from '../lib/types'
import { StatusTag } from './StatusTag'

interface Props {
  tasks: Task[]
  loading?: boolean
  showObject?: boolean
}

export function TasksTable({ tasks, loading, showObject = true }: Props) {
  const columns: TableColumnsType<Task> = [
    {
      title: 'Задача',
      dataIndex: 'title',
      render: (_, task) => <Link to={`/tasks/${task.id}`}>{task.title}</Link>,
    },
    ...(showObject
      ? [
          {
            title: 'Объект',
            key: 'object',
            render: (_: unknown, task: Task) =>
              task.object ? <Link to={`/objects/${task.object.id}`}>{task.object.name}</Link> : '—',
          },
        ]
      : []),
    {
      title: 'Исполнитель',
      key: 'assignee',
      render: (_, task) => task.assignee?.full_name ?? '—',
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      width: 150,
      filters: STATUS_ORDER.map((s) => ({ text: STATUS_LABELS[s], value: s })),
      onFilter: (value, task) => task.status === value,
      render: (_, task) => <StatusTag status={task.status} />,
    },
    {
      title: 'Создана',
      dataIndex: 'created_at',
      width: 150,
      sorter: (a, b) => a.created_at.localeCompare(b.created_at),
      render: (value: string) => formatDateTime(value),
    },
  ]

  return (
    <Table
      rowKey="id"
      columns={columns}
      dataSource={tasks}
      loading={loading}
      pagination={{ pageSize: 20, hideOnSinglePage: true }}
      locale={{ emptyText: 'Задач нет' }}
    />
  )
}
