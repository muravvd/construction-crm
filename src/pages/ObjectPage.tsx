import { PlusOutlined } from '@ant-design/icons'
import { Alert, App, Breadcrumb, Button, Card, Descriptions, Flex, Popconfirm, Result, Spin, Typography } from 'antd'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useProfile } from '../auth/authContext'
import { ObjectFormModal } from '../components/ObjectFormModal'
import { TaskFormModal } from '../components/TaskFormModal'
import { TasksTable } from '../components/TasksTable'
import { useAsync } from '../hooks/useAsync'
import { deleteObject, errorMessage, getObject, listTasks } from '../lib/api'

export function ObjectPage() {
  const { objectId = '' } = useParams()
  const profile = useProfile()
  const isManager = profile.role === 'manager'
  const navigate = useNavigate()
  const { message } = App.useApp()

  const object = useAsync(() => getObject(objectId), objectId)
  const tasks = useAsync(() => listTasks({ objectId }), objectId)
  const [editingObject, setEditingObject] = useState(false)
  const [creatingTask, setCreatingTask] = useState(false)

  if (object.loading && !object.data) return <Spin />
  if (object.error) return <Alert type="error" title={object.error} />
  if (!object.data) {
    return (
      <Result
        status="404"
        title="Объект не найден"
        subTitle="Объект не существует или у вас нет к нему доступа."
        extra={<Link to="/objects">К списку объектов</Link>}
      />
    )
  }

  const obj = object.data

  async function handleDelete() {
    try {
      await deleteObject(obj.id)
      message.success('Объект удалён')
      navigate('/objects')
    } catch (e) {
      message.error(errorMessage(e))
    }
  }

  return (
    <Flex vertical gap={16}>
      <Breadcrumb items={[{ title: <Link to="/objects">Объекты</Link> }, { title: obj.name }]} />
      <Card
        title={<Typography.Title level={3} style={{ margin: 0 }}>{obj.name}</Typography.Title>}
        extra={
          isManager && (
            <Flex gap={8}>
              <Button onClick={() => setEditingObject(true)}>Изменить</Button>
              <Popconfirm
                title="Удалить объект?"
                description="Будут удалены и все задачи этого объекта."
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
        <Descriptions column={1} items={[{ key: 'address', label: 'Адрес', children: obj.address }]} />
      </Card>

      <Card
        title={isManager ? 'Задачи объекта' : 'Мои задачи на объекте'}
        extra={
          isManager && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreatingTask(true)}>
              Новая задача
            </Button>
          )
        }
      >
        {tasks.error && <Alert type="error" title={tasks.error} style={{ marginBottom: 16 }} />}
        <TasksTable tasks={tasks.data ?? []} loading={tasks.loading} showObject={false} />
      </Card>

      <ObjectFormModal
        open={editingObject}
        object={obj}
        onClose={() => setEditingObject(false)}
        onSaved={() => {
          setEditingObject(false)
          object.reload()
        }}
      />
      <TaskFormModal
        open={creatingTask}
        defaultObjectId={obj.id}
        onClose={() => setCreatingTask(false)}
        onSaved={() => {
          setCreatingTask(false)
          tasks.reload()
        }}
      />
    </Flex>
  )
}
