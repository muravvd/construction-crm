import { Alert, Button, Card, Flex, Form, Input, Typography } from 'antd'
import { useState } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from '../auth/authContext'
import { errorMessage } from '../lib/api'

export function LoginPage() {
  const { session, loading, signIn } = useAuth()
  const location = useLocation()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && session) {
    const from = (location.state as { from?: string } | null)?.from ?? '/'
    return <Navigate to={from} replace />
  }

  async function handleFinish(values: { email: string; password: string }) {
    setError(null)
    setSubmitting(true)
    try {
      await signIn(values.email.trim(), values.password)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Flex justify="center" align="center" style={{ minHeight: '100vh', background: '#f5f5f5', padding: 16 }}>
      <Card style={{ width: 380 }}>
        <Typography.Title level={3} style={{ marginTop: 0 }}>
          СтройCRM
        </Typography.Title>
        <Typography.Paragraph type="secondary">Вход для сотрудников</Typography.Paragraph>
        {error && <Alert type="error" title={error} showIcon style={{ marginBottom: 16 }} />}
        <Form layout="vertical" onFinish={handleFinish} requiredMark={false}>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email', message: 'Введите email' }]}>
            <Input autoComplete="username" autoFocus />
          </Form.Item>
          <Form.Item name="password" label="Пароль" rules={[{ required: true, message: 'Введите пароль' }]}>
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={submitting}>
            Войти
          </Button>
        </Form>
      </Card>
    </Flex>
  )
}
