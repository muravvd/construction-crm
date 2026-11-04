import { PlusOutlined } from '@ant-design/icons'
import { Alert, Button, Flex, Typography } from 'antd'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useProfile } from '../auth/authContext'
import { TaskFormModal } from '../components/TaskFormModal'
import { TasksTable } from '../components/TasksTable'
import { useAsync } from '../hooks/useAsync'
import { listTasks } from '../lib/api'

export function TasksPage() {
  const profile = useProfile()
  const isManager = profile.role === 'manager'
  const navigate = useNavigate()
  const tasks = useAsync(() => listTasks(), 'tasks')
  const [creating, setCreating] = useState(false)

  return (
    <>
      <Flex justify="space-between" align="center" style={{ marginBottom: 16 }}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          {isManager ? 'Все задачи' : 'Мои задачи'}
        </Typography.Title>
        {isManager && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>
            Новая задача
          </Button>
        )}
      </Flex>
      {tasks.error && <Alert type="error" title={tasks.error} style={{ marginBottom: 16 }} />}
      <TasksTable tasks={tasks.data ?? []} loading={tasks.loading} />
      <TaskFormModal
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={(id) => navigate(`/tasks/${id}`)}
      />
    </>
  )
}
