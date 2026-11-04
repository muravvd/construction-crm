import { Alert, App, Breadcrumb, Button, Card, Descriptions, Flex, Popconfirm, Result, Spin, Typography } from 'antd'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useProfile } from '../auth/authContext'
import { StatusTag } from '../components/StatusTag'
import { TaskFormModal } from '../components/TaskFormModal'
import { TaskHistory } from '../components/TaskHistory'
import { TaskStatusActions } from '../components/TaskStatusActions'
import { useAsync } from '../hooks/useAsync'
import { deleteTask, errorMessage, getTask, getTaskHistory } from '../lib/api'
import { formatDateTime } from '../lib/format'

export function TaskPage() {
  const { taskId = '' } = useParams()
  const profile = useProfile()
  const isManager = profile.role === 'manager'
  const navigate = useNavigate()
  const { message } = App.useApp()

  const task = useAsync(() => getTask(taskId), taskId)
  const history = useAsync(() => getTaskHistory(taskId), taskId)
  const [editing, setEditing] = useState(false)

  if (task.loading && !task.data) return <Spin />
  if (task.error) return <Alert type="error" title={task.error} />
  if (!task.data) {
    return (
      <Result
        status="404"
        title="Задача не найдена"
        subTitle="Задача не существует или у вас нет к ней доступа."
        extra={<Link to="/tasks">К списку задач</Link>}
      />
    )
  }

  const t = task.data

  function reloadAll() {
    task.reload()
    history.reload()
  }

  async function handleDelete() {
    try {
      await deleteTask(t.id)
      message.success('Задача удалена')
      navigate(t.object ? `/objects/${t.object.id}` : '/tasks')
    } catch (e) {
      message.error(errorMessage(e))
    }
  }

  return (
    <Flex vertical gap={16}>
      <Breadcrumb
        items={[
          { title: <Link to="/objects">Объекты</Link> },
          ...(t.object ? [{ title: <Link to={`/objects/${t.object.id}`}>{t.object.name}</Link> }] : []),
          { title: t.title },
        ]}
      />
      <Card
        title={
          <Flex align="center" gap={12} wrap>
            <Typography.Title level={3} style={{ margin: 0 }}>
              {t.title}
            </Typography.Title>
            <StatusTag status={t.status} />
          </Flex>
        }
        extra={
          isManager && (
            <Flex gap={8}>
              <Button onClick={() => setEditing(true)}>Изменить</Button>
              <Popconfirm
                title="Удалить задачу?"
                description="Задача будет удалена вместе с историей."
                okText="Удалить"
                cancelText="Отмена"
                okButtonProps={{ danger: true }}
                onConfirm={handleDelete}
              >
                <Button danger>Удалить</Button>
              </Popconfirm>
            </Flex>
          )
        }
      >
        <Descriptions
          column={{ xs: 1, md: 2 }}
          items={[
            {
              key: 'object',
              label: 'Объект',
              children: t.object ? <Link to={`/objects/${t.object.id}`}>{t.object.name}</Link> : '—',
            },
            { key: 'status', label: 'Статус', children: <StatusTag status={t.status} /> },
            { key: 'assignee', label: 'Исполнитель', children: t.assignee?.full_name ?? '—' },
            { key: 'author', label: 'Автор', children: t.author?.full_name ?? '—' },
            { key: 'created', label: 'Создана', children: formatDateTime(t.created_at) },
            {
              key: 'description',
              label: 'Описание',
              span: 'filled',
              children: <div style={{ whiteSpace: 'pre-wrap' }}>{t.description || '—'}</div>,
            },
          ]}
        />
        <div style={{ marginTop: 16 }}>
          <TaskStatusActions task={t} profile={profile} onChanged={reloadAll} />
        </div>
      </Card>

      <Card title="История статусов">
        {history.error ? (
          <Alert type="error" title={history.error} />
        ) : history.loading && !history.data ? (
          <Spin />
        ) : (
          <TaskHistory entries={history.data ?? []} />
        )}
      </Card>

      <TaskFormModal
        open={editing}
        task={t}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false)
          reloadAll()
        }}
      />
    </Flex>
  )
}
