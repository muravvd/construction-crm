import { useCallback, useEffect, useEffectEvent, useState } from 'react'
import { errorMessage } from '../lib/api'

interface Result<T> {
  key: string
  version: number
  data: T | undefined
  error: string | null
}

// Загружает данные при первом показе и при смене key; reload() — повторная загрузка.
export function useAsync<T>(load: () => Promise<T>, key: string) {
  const [result, setResult] = useState<Result<T> | null>(null)
  const [version, setVersion] = useState(0)
  const runLoad = useEffectEvent(load)

  useEffect(() => {
    let cancelled = false
    runLoad().then(
      (data) => !cancelled && setResult({ key, version, data, error: null }),
      (e) => !cancelled && setResult({ key, version, data: undefined, error: errorMessage(e) }),
    )
    return () => {
      cancelled = true
    }
  }, [key, version])

  const reload = useCallback(() => setVersion((v) => v + 1), [])

  // При reload() показываем прежние данные, пока не придут новые.
  const sameKey = result?.key === key
  return {
    data: sameKey ? result.data : undefined,
    error: sameKey ? result.error : null,
    loading: !sameKey || result.version !== version,
    reload,
  }
}
