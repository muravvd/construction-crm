import { App, Form, Input, Modal } from 'antd'
import { useState } from 'react'
import { createObject, errorMessage, updateObject } from '../lib/api'
import type { ConstructionObject, ObjectInput } from '../lib/types'

interface Props {
  open: boolean
  object?: ConstructionObject
  onClose: () => void
  onSaved: (id: string) => void
}

export function ObjectFormModal({ open, object, onClose, onSaved }: Props) {
  const [form] = Form.useForm<ObjectInput>()
  const [saving, setSaving] = useState(false)
  const { message } = App.useApp()

  async function handleOk() {
    const values = await form.validateFields().catch(() => null)
    if (!values) return
    const input = { name: values.name.trim(), address: values.address.trim() }
    setSaving(true)
    try {
      const id = object ? (await updateObject(object.id, input), object.id) : await createObject(input)
      message.success(object ? 'Объект сохранён' : 'Объект создан')
      onSaved(id)
    } catch (e) {
      message.error(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      title={object ? 'Редактировать объект' : 'Новый объект'}
      okText={object ? 'Сохранить' : 'Создать'}
      cancelText="Отмена"
      confirmLoading={saving}
      onOk={handleOk}
      onCancel={onClose}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        preserve={false}
        initialValues={object ? { name: object.name, address: object.address } : undefined}
      >
        <Form.Item
          name="name"
          label="Название"
          rules={[{ required: true, whitespace: true, message: 'Укажите название' }, { max: 200 }]}
        >
          <Input autoFocus />
        </Form.Item>
        <Form.Item
          name="address"
          label="Адрес"
          rules={[{ required: true, whitespace: true, message: 'Укажите адрес' }, { max: 500 }]}
        >
          <Input />
        </Form.Item>
      </Form>
    </Modal>
  )
}
