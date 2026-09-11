import { API_BASE_URL } from '@/lib/auth/config'
import { getAccessToken, refreshAccessToken } from '@/lib/auth/store'

export class SessionExpiredError extends Error {
  constructor() {
    super('Your session has expired.')
    this.name = 'SessionExpiredError'
  }
}

/**
 * Fetch wrapper for authenticated API calls: attaches the current access token,
 * and on a 401 silently refreshes and retries the request exactly once before
 * giving up and surfacing SessionExpiredError.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetchWithToken(path, init, getAccessToken())

  if (response.status !== 401) {
    return parseJson<T>(response)
  }

  const refreshedToken = await refreshAccessToken()
  if (!refreshedToken) {
    throw new SessionExpiredError()
  }

  const retried = await fetchWithToken(path, init, refreshedToken)
  if (retried.status === 401) {
    throw new SessionExpiredError()
  }
  return parseJson<T>(retried)
}

function fetchWithToken(path: string, init: RequestInit, accessToken: string | null): Promise<Response> {
  const headers = new Headers(init.headers)
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }
  return fetch(`${API_BASE_URL}${path}`, { ...init, headers })
}

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`)
  }
  return (await response.json()) as T
}
