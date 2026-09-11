import { HttpResponse, http } from 'msw'

import { API_BASE_URL } from '@/lib/auth/config'

export const VALID_CREDENTIALS = { email: 'user@example.com', password: 'correct-password' }

export const TOKENS = {
  access: 'test-access-token',
  refreshed: 'test-refreshed-access-token',
  refresh: 'test-refresh-token',
}

export const CURRENT_USER = {
  id: 'a3f2e1a0-1234-4a5b-8c9d-0123456789ab',
  email: VALID_CREDENTIALS.email,
  is_active: true,
  is_superuser: false,
  is_verified: true,
}

export function loginHandler() {
  return http.post(`${API_BASE_URL}/auth/jwt/login`, async ({ request }) => {
    const body = await request.formData()
    if (body.get('username') === VALID_CREDENTIALS.email && body.get('password') === VALID_CREDENTIALS.password) {
      return HttpResponse.json({
        access_token: TOKENS.access,
        refresh_token: TOKENS.refresh,
        token_type: 'bearer',
      })
    }
    return HttpResponse.json({ detail: 'LOGIN_BAD_CREDENTIALS' }, { status: 400 })
  })
}

export function refreshHandler(accessToken: string = TOKENS.refreshed) {
  return http.post(`${API_BASE_URL}/auth/jwt/refresh`, async ({ request }) => {
    const body = (await request.json()) as { refresh_token: string }
    if (body.refresh_token === TOKENS.refresh) {
      return HttpResponse.json({ access_token: accessToken })
    }
    return HttpResponse.json({ detail: 'INVALID_REFRESH_TOKEN' }, { status: 401 })
  })
}

export function refreshFailsHandler() {
  return http.post(`${API_BASE_URL}/auth/jwt/refresh`, () =>
    HttpResponse.json({ detail: 'INVALID_REFRESH_TOKEN' }, { status: 401 }),
  )
}

export function currentUserHandler(validTokens: string[] = [TOKENS.access]) {
  return http.get(`${API_BASE_URL}/users/me`, ({ request }) => {
    const authorization = request.headers.get('Authorization')
    const token = authorization?.replace('Bearer ', '')
    if (token && validTokens.includes(token)) {
      return HttpResponse.json(CURRENT_USER)
    }
    return HttpResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  })
}
