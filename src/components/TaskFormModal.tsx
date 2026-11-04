import { App, Form, Input, Modal, Select } from 'antd'
import { useState } from 'react'
import { useAsync } from '../hooks/useAsync'
import { createTask, errorMessage, listExecutors, listObjects, updateTask } from '../lib/api'
import type { Task, TaskInput } from '../lib/types'

interface Props {
  open: boolean
  task?: Task
  defaultObjectId?: string
  onClose: () => void
  onSaved: (id: string) => void
}

export function TaskFormModal({ open, task, defaultObjectId, onClose, onSaved }: Props) {
  const [form] = Form.useForm<TaskInput>()
  const [saving, setSaving] = useState(false)
  const { message } = App.useApp()

  const options = useAsync(
    async () => (open ? Promise.all([listObjects(), listExecutors()]) : undefined),
    open ? 'open' : 'closed',
  )
  const [objects, executors] = options.data ?? [[], []]

  async function handleOk() {
    const values = await form.validateFields()
    const input: TaskInput = {
      object_id: values.object_id,
      assignee_id: values.assignee_id,
      title: values.title.trim(),
      description: (values.description ?? '').trim(),
    }
    setSaving(true)
    try {
      const id = task ? (await updateTask(task.id, input), task.id) : await createTask(input)
      message.success(task ? 'Задача сохранена' : 'Задача создана')
      onSaved(id)
    } catch (e) {
      message.error(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const initialValues: Partial<TaskInput> = task
    ? { title: task.title, description: task.description, object_id: task.object_id, assignee_id: task.assignee_id }
    : { object_id: defaultObjectId }

  return (
    <Modal
      open={open}
      title={task ? 'Редактировать задачу' : 'Новая задача'}
      okText={task ? 'Сохранить' : 'Создать'}
      cancelText="Отмена"
      confirmLoading={saving}
      onOk={handleOk}
      onCancel={onClose}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" preserve={false} initialValues={initialValues}>
        <Form.Item
          name="title"
          label="Название"
          rules={[{ required: true, whitespace: true, message: 'Укажите название' }, { max: 200 }]}
        >
          <Input autoFocus />
        </Form.Item>
        <Form.Item name="description" label="Описание" rules={[{ max: 5000 }]}>
          <Input.TextArea rows={4} />
        </Form.Item>
        <Form.Item name="object_id" label="Объект" rules={[{ required: true, message: 'Выберите объект' }]}>
          <Select
            loading={options.loading}
            showSearch={{ optionFilterProp: 'label' }}
            options={objects.map((o) => ({ value: o.id, label: o.name }))}
          />
        </Form.Item>
        <Form.Item
          name="assignee_id"
          label="Исполнитель"
          rules={[{ required: true, message: 'Выберите исполнителя' }]}
        >
          <Select
            loading={options.loading}
            showSearch={{ optionFilterProp: 'label' }}
            options={executors.map((p) => ({ value: p.id, label: p.full_name }))}
          />
        </Form.Item>
      </Form>
      {options.error && <div style={{ color: 'red' }}>{options.error}</div>}
    </Modal>
  )
}
