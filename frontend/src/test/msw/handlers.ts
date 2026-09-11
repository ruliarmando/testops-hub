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

export const PROJECTS = [
  { id: 'b7e6d5c4-1111-4a5b-8c9d-0123456789ab', name: 'Website QA', owner_id: CURRENT_USER.id },
  { id: 'b7e6d5c4-2222-4a5b-8c9d-0123456789ab', name: 'Mobile App', owner_id: CURRENT_USER.id },
]

export function listProjectsHandler(projects: typeof PROJECTS = PROJECTS) {
  return http.get(`${API_BASE_URL}/projects`, () => HttpResponse.json(projects))
}

/** A GET/POST /projects pair sharing one in-memory list, for tests that create a project and expect it to show up in a later list fetch. */
export function projectsCrudHandlers(initialProjects: typeof PROJECTS = []) {
  let projects = initialProjects
  return [
    http.get(`${API_BASE_URL}/projects`, () => HttpResponse.json(projects)),
    http.post(`${API_BASE_URL}/projects`, async ({ request }) => {
      const body = (await request.json()) as { name: string }
      const created = { id: crypto.randomUUID(), name: body.name, owner_id: CURRENT_USER.id }
      projects = [...projects, created]
      return HttpResponse.json(created, { status: 201 })
    }),
  ]
}

export interface RunFixture {
  id: string
  project_id: string
  created_at: string
  run_metadata: Record<string, unknown> | null
  pass_rate: number | null
}

export function makeRun(overrides: Partial<RunFixture> & Pick<RunFixture, 'created_at'>): RunFixture {
  return {
    id: crypto.randomUUID(),
    project_id: PROJECTS[0].id,
    run_metadata: null,
    pass_rate: 100,
    ...overrides,
  }
}

export function listRunsHandler(projectId: string, runs: RunFixture[]) {
  return http.get(`${API_BASE_URL}/projects/${projectId}/runs`, () => HttpResponse.json(runs))
}
