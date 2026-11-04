import { PlusOutlined } from '@ant-design/icons'
import { Alert, App, Button, Flex, Popconfirm, Table, Typography, type TableColumnsType } from 'antd'
import { useState } from 'react'
import { Link } from 'react-router'
import { useProfile } from '../auth/authContext'
import { ObjectFormModal } from '../components/ObjectFormModal'
import { useAsync } from '../hooks/useAsync'
import { deleteObject, errorMessage, listObjects } from '../lib/api'
import type { ObjectListItem } from '../lib/types'

export function ObjectsPage() {
  const profile = useProfile()
  const isManager = profile.role === 'manager'
  const { message } = App.useApp()
  const objects = useAsync(listObjects, 'objects')
  const [editing, setEditing] = useState<ObjectListItem | 'new' | null>(null)

  async function handleDelete(id: string) {
    try {
      await deleteObject(id)
      message.success('Объект удалён')
      objects.reload()
    } catch (e) {
      message.error(errorMessage(e))
    }
  }

  const columns: TableColumnsType<ObjectListItem> = [
    {
      title: 'Название',
      dataIndex: 'name',
      render: (_, o) => <Link to={`/objects/${o.id}`}>{o.name}</Link>,
    },
    { title: 'Адрес', dataIndex: 'address' },
    {
      title: isManager ? 'Задач (открытых / всего)' : 'Моих задач (открытых / всего)',
      key: 'tasks',
      width: 220,
      render: (_, o) => `${o.tasks.filter((t) => t.status !== 'accepted').length} / ${o.tasks.length}`,
    },
  ]

  if (isManager) {
    columns.push({
      title: '',
      key: 'actions',
      width: 200,
      render: (_, o) => (
        <Flex gap={8}>
          <Button size="small" onClick={() => setEditing(o)}>
            Изменить
          </Button>
          <Popconfirm
            title="Удалить объект?"
            description={`Будут удалены и все задачи объекта (${o.tasks.length}).`}
            okText="Удалить"
            cancelText="Отмена"
            okButtonProps={{ danger: true }}
            onConfirm={() => handleDelete(o.id)}
          >
            <Button size="small" danger>
              Удалить
            </Button>
          </Popconfirm>
        </Flex>
      ),
    })
  }

  return (
    <>
      <Flex justify="space-between" align="center" style={{ marginBottom: 16 }}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          Объекты
        </Typography.Title>
        {isManager && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing('new')}>
            Новый объект
          </Button>
        )}
      </Flex>
      {objects.error && <Alert type="error" title={objects.error} style={{ marginBottom: 16 }} />}
      <Table
        rowKey="id"
        columns={columns}
        dataSource={objects.data}
        loading={objects.loading}
        pagination={false}
        locale={{ emptyText: isManager ? 'Объектов пока нет' : 'У вас пока нет объектов с задачами' }}
      />
      <ObjectFormModal
        open={editing !== null}
        object={editing && editing !== 'new' ? editing : undefined}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null)
          objects.reload()
        }}
      />
    </>
  )
}
