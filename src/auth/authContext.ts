import type { Session } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'
import type { Profile } from '../lib/types'

export interface AuthState {
  session: Session | null
  profile: Profile | null
  profileError: string | null
  loading: boolean
  // Пользователь сам нажал «Выйти»: после следующего входа не возвращаем на его последнюю страницу.
  signedOut: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth должен использоваться внутри AuthProvider')
  return ctx
}

// Для страниц, которые рендерятся только после входа (под RequireAuth).
export function useProfile(): Profile {
  const { profile } = useAuth()
  if (!profile) throw new Error('Профиль ещё не загружен')
  return profile
}
