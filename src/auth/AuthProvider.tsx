import type { Session } from '@supabase/supabase-js'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/types'
import { AuthContext, type AuthState } from './authContext'

interface ProfileResult {
  userId: string
  profile: Profile | null
  error: string | null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // undefined — сессия ещё не прочитана из хранилища браузера
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [loaded, setLoaded] = useState<ProfileResult | null>(null)

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => setSession(newSession))
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id

  useEffect(() => {
    if (!userId) return

    let cancelled = false
    supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('id', userId)
      .maybeSingle<Profile>()
      .then(({ data, error }) => {
        if (cancelled) return
        setLoaded({
          userId,
          profile: data,
          error: error
            ? error.message
            : data
              ? null
              : 'Профиль пользователя не найден. Обратитесь к администратору.',
        })
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  // Результат загрузки относится к конкретному пользователю: после смены входа старый профиль не показываем.
  const current = userId && loaded?.userId === userId ? loaded : null
  const profile = current?.profile ?? null
  const profileError = current?.error ?? null

  const value = useMemo<AuthState>(
    () => ({
      session: session ?? null,
      profile,
      profileError,
      loading: session === undefined || (!!userId && !profile && !profileError),
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) {
          throw new Error(
            error.message === 'Invalid login credentials' ? 'Неверный email или пароль' : error.message,
          )
        }
      },
      async signOut() {
        await supabase.auth.signOut()
      },
    }),
    [session, userId, profile, profileError],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
