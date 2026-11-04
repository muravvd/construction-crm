import { LogoutOutlined } from '@ant-design/icons'
import { Button, Flex, Layout, Menu, Tag, Typography } from 'antd'
import { Link, Outlet, useLocation } from 'react-router'
import { useAuth, useProfile } from '../auth/authContext'

export function AppLayout() {
  const { signOut } = useAuth()
  const profile = useProfile()
  const location = useLocation()
  const isManager = profile.role === 'manager'

  const selected = location.pathname.startsWith('/tasks') ? '/tasks' : '/objects'

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Layout.Header style={{ display: 'flex', alignItems: 'center', gap: 24, paddingInline: 24 }}>
        <Link to="/" style={{ color: '#fff', fontWeight: 600, fontSize: 18, whiteSpace: 'nowrap' }}>
          СтройCRM
        </Link>
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[selected]}
          style={{ flex: 1, minWidth: 0 }}
          items={[
            { key: '/objects', label: <Link to="/objects">Объекты</Link> },
            { key: '/tasks', label: <Link to="/tasks">{isManager ? 'Все задачи' : 'Мои задачи'}</Link> },
          ]}
        />
        <Flex align="center" gap={12}>
          <Typography.Text style={{ color: '#fff' }}>{profile.full_name}</Typography.Text>
          <Tag color={isManager ? 'geekblue' : 'cyan'}>{isManager ? 'Постановщик' : 'Исполнитель'}</Tag>
          <Button icon={<LogoutOutlined />} onClick={signOut}>
            Выйти
          </Button>
        </Flex>
      </Layout.Header>
      <Layout.Content style={{ padding: 24, maxWidth: 1200, width: '100%', margin: '0 auto' }}>
        <Outlet />
      </Layout.Content>
    </Layout>
  )
}
