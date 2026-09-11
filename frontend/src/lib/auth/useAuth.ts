import { useSyncExternalStore } from 'react'

import { getSnapshot, login, logout, subscribe } from './store'

export function useAuth() {
  const state = useSyncExternalStore(subscribe, getSnapshot)
  return { ...state, login, logout }
}
