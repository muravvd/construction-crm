import { App as AntApp, ConfigProvider, Result } from 'antd'
import ruRU from 'antd/locale/ru_RU'
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router'
import { AuthProvider } from './auth/AuthProvider'
import { RequireAuth } from './auth/RequireAuth'
import { useProfile } from './auth/authContext'
import { AppLayout } from './components/AppLayout'
import { LoginPage } from './pages/LoginPage'
import { ObjectPage } from './pages/ObjectPage'
import { ObjectsPage } from './pages/ObjectsPage'
import { TaskPage } from './pages/TaskPage'
import { TasksPage } from './pages/TasksPage'

function HomeRedirect() {
  const profile = useProfile()
  return <Navigate to={profile.role === 'manager' ? '/objects' : '/tasks'} replace />
}

export default function App() {
  return (
    <ConfigProvider locale={ruRU}>
      <AntApp>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                element={
                  <RequireAuth>
                    <AppLayout />
                  </RequireAuth>
                }
              >
                <Route index element={<HomeRedirect />} />
                <Route path="objects" element={<ObjectsPage />} />
                <Route path="objects/:objectId" element={<ObjectPage />} />
                <Route path="tasks" element={<TasksPage />} />
                <Route path="tasks/:taskId" element={<TaskPage />} />
                <Route
                  path="*"
                  element={<Result status="404" title="Страница не найдена" extra={<Link to="/">На главную</Link>} />}
                />
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </AntApp>
    </ConfigProvider>
  )
}
