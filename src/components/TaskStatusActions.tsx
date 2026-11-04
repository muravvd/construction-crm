import { App, Button, Flex, Form, Input, Modal, Typography } from 'antd'
import { useState } from 'react'
import { changeTaskStatus, errorMessage } from '../lib/api'
import { STATUS_LABELS, availableActions, type StatusAction } from '../lib/status'
import type { Profile, Task } from '../lib/types'

interface Props {
  task: Task
  profile: Profile
  onChanged: () => void
}

export function TaskStatusActions({ task, profile, onChanged }: Props) {
  const [action, setAction] = useState<StatusAction | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm<{ comment?: string }>()
  const { message } = App.useApp()

  const actions = availableActions(task, profile)
  if (actions.length === 0) return null

  async function handleOk() {
    if (!action) return
    const values = await form.validateFields().catch(() => null)
    if (!values) return
    setSaving(true)
    try {
      await changeTaskStatus(task.id, action.to, values.comment)
      message.success(`Статус изменён: «${STATUS_LABELS[action.to]}»`)
      setAction(null)
      onChanged()
    } catch (e) {
      message.error(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Flex gap={8} wrap>
        {actions.map((a) => (
          <Button key={a.to} type={a.danger ? 'default' : 'primary'} danger={a.danger} onClick={() => setAction(a)}>
            {a.label}
          </Button>
        ))}
      </Flex>
      <Modal
        open={!!action}
        title={action?.label}
        okText="Подтвердить"
        cancelText="Отмена"
        okButtonProps={{ danger: action?.danger }}
        confirmLoading={saving}
        onOk={handleOk}
        onCancel={() => setAction(null)}
        destroyOnHidden
      >
        {action && (
          <>
            <Typography.Paragraph>
              Статус: «{STATUS_LABELS[task.status]}» → «{STATUS_LABELS[action.to]}»
            </Typography.Paragraph>
            <Form form={form} layout="vertical" preserve={false}>
              <Form.Item
                name="comment"
                label={action.commentRequired ? 'Комментарий (что нужно исправить)' : 'Комментарий (необязательно)'}
                rules={[
                  { required: action.commentRequired, whitespace: true, message: 'Комментарий обязателен' },
                  { max: 2000 },
                ]}
              >
                <Input.TextArea rows={3} autoFocus />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>
    </>
  )
}
