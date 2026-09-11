import { fetchCurrentUserRequest, loginRequest, refreshRequest, type CurrentUser } from './api'
import { clearStoredRefreshToken, getStoredRefreshToken, setStoredRefreshToken } from './tokenStorage'

export type AuthStatus = 'unauthenticated' | 'authenticated'

interface AuthState {
  status: AuthStatus
  accessToken: string | null
  user: CurrentUser | null
}

let state: AuthState = { status: 'unauthenticated', accessToken: null, user: null }
const listeners = new Set<() => void>()

function setState(next: AuthState) {
  state = next
  for (const listener of listeners) listener()
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getSnapshot(): AuthState {
  return state
}

export function getAccessToken(): string | null {
  return state.accessToken
}

async function establishSession(accessToken: string): Promise<void> {
  const user = await fetchCurrentUserRequest(accessToken)
  setState({ status: 'authenticated', accessToken, user })
}

export async function login(email: string, password: string): Promise<void> {
  const tokens = await loginRequest(email, password)
  setStoredRefreshToken(tokens.refresh_token)
  try {
    await establishSession(tokens.access_token)
  } catch {
    // The credentials were valid and tokens were issued; a hiccup fetching the
    // profile shouldn't fail the login itself. `user` can be filled in later.
    setState({ status: 'authenticated', accessToken: tokens.access_token, user: null })
  }
}

export function logout(): void {
  clearStoredRefreshToken()
  setState({ status: 'unauthenticated', accessToken: null, user: null })
}

export function hasStoredSession(): boolean {
  return getStoredRefreshToken() !== null
}

let inFlightRefresh: Promise<string | null> | null = null

/** Coalesces concurrent callers (route guard + retried API calls) onto a single refresh request. */
export function refreshAccessToken(): Promise<string | null> {
  if (!inFlightRefresh) {
    inFlightRefresh = performRefresh().finally(() => {
      inFlightRefresh = null
    })
  }
  return inFlightRefresh
}

async function performRefresh(): Promise<string | null> {
  const refreshToken = getStoredRefreshToken()
  if (!refreshToken) {
    logout()
    return null
  }

  let accessToken: string
  try {
    accessToken = (await refreshRequest(refreshToken)).access_token
  } catch {
    // The refresh token itself is invalid/expired: per ADR-0002 this is a real logout.
    logout()
    return null
  }

  try {
    await establishSession(accessToken)
    return accessToken
  } catch {
    // The refresh succeeded but fetching the profile failed (e.g. a transient
    // network blip) — leave the still-valid refresh token in place rather than
    // forcing a real logout; the caller just treats this attempt as failed.
    return null
  }
}

export async function ensureAuthenticated(): Promise<boolean> {
  if (state.status === 'authenticated') return true
  const token = await refreshAccessToken()
  return token !== null
}
