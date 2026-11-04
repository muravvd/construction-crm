import { Button, Flex, Result, Spin } from 'antd'
import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from './authContext'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, profileError, loading, signOut } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <Flex justify="center" align="center" style={{ minHeight: '100vh' }}>
        <Spin size="large" />
      </Flex>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (profileError) {
    return (
      <Result
        status="error"
        title="Не удалось загрузить профиль"
        subTitle={profileError}
        extra={<Button onClick={signOut}>Выйти</Button>}
      />
    )
  }

  return children
}
