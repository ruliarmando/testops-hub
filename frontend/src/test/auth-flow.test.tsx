import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryHistory } from '@tanstack/react-router'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'

import { createApp } from '@/App'
import { apiFetch } from '@/lib/api/client'
import { API_BASE_URL } from '@/lib/auth/config'
import type { CurrentUser } from '@/lib/auth/api'
import { login, logout } from '@/lib/auth/store'
import { setStoredRefreshToken } from '@/lib/auth/tokenStorage'
import { createAppRouter } from '@/router'
import { server } from '@/test/msw/server'
import {
  CURRENT_USER,
  TOKENS,
  VALID_CREDENTIALS,
  currentUserHandler,
  listProjectsHandler,
  loginHandler,
  refreshFailsHandler,
  refreshHandler,
} from '@/test/msw/handlers'

afterEach(() => {
  logout()
})

function renderApp(initialPath: string) {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [initialPath] }))
  const { App, queryClient } = createApp(router)
  render(<App />)
  return { router, queryClient }
}

describe('login page', () => {
  it('navigates past /login on successful login', async () => {
    server.use(loginHandler(), currentUserHandler([TOKENS.access]), listProjectsHandler())
    const user = userEvent.setup()
    renderApp('/login')

    await user.type(await screen.findByLabelText('Email'), VALID_CREDENTIALS.email)
    await user.type(screen.getByLabelText('Password'), VALID_CREDENTIALS.password)
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Log in' })).not.toBeInTheDocument())
    expect(await screen.findByRole('heading', { name: 'Projects' })).toBeInTheDocument()
  })

  it('shows an error and stays on /login for wrong credentials', async () => {
    server.use(loginHandler())
    const user = userEvent.setup()
    renderApp('/login')

    await user.type(await screen.findByLabelText('Email'), VALID_CREDENTIALS.email)
    await user.type(screen.getByLabelText('Password'), 'wrong-password')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.')
    expect(screen.getByRole('heading', { name: 'Log in' })).toBeInTheDocument()
  })
})

describe('route guarding', () => {
  it('redirects an unauthenticated visitor to /login', async () => {
    renderApp('/')

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('restores the session from a stored refresh token across a page refresh', async () => {
    setStoredRefreshToken(TOKENS.refresh)
    server.use(refreshHandler(TOKENS.refreshed), currentUserHandler([TOKENS.refreshed]), listProjectsHandler())

    renderApp('/')

    expect(await screen.findByRole('heading', { name: 'Projects' })).toBeInTheDocument()
  })

  it('redirects to /login with a session-expired reason when the stored refresh token is no longer valid', async () => {
    setStoredRefreshToken('a-stale-refresh-token')
    server.use(refreshFailsHandler())

    renderApp('/')

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument()
    expect(await screen.findByRole('status')).toHaveTextContent('Your session ended. Please log in again.')
  })
})

describe('authenticated API calls', () => {
  it('silently refreshes and retries once after a 401, without the user seeing it', async () => {
    let originalTokenUses = 0
    server.use(
      loginHandler(),
      refreshHandler(TOKENS.refreshed),
      listProjectsHandler(),
      http.get(`${API_BASE_URL}/users/me`, ({ request }) => {
        const auth = request.headers.get('Authorization')
        if (auth === `Bearer ${TOKENS.access}`) {
          originalTokenUses += 1
          if (originalTokenUses === 1) return HttpResponse.json(CURRENT_USER)
          return HttpResponse.json({ detail: 'Unauthorized' }, { status: 401 })
        }
        if (auth === `Bearer ${TOKENS.refreshed}`) return HttpResponse.json(CURRENT_USER)
        return HttpResponse.json({ detail: 'Unauthorized' }, { status: 401 })
      }),
    )

    await login(VALID_CREDENTIALS.email, VALID_CREDENTIALS.password)
    const { router } = renderApp('/')

    await expect(apiFetch<CurrentUser>('/users/me')).resolves.toEqual(CURRENT_USER)
    expect(router.state.location.pathname).toBe('/projects')
    expect(screen.queryByRole('heading', { name: 'Log in' })).not.toBeInTheDocument()
  })

  it('redirects to /login with a session-expired reason when refresh also fails', async () => {
    let originalTokenUses = 0
    server.use(
      loginHandler(),
      listProjectsHandler(),
      http.get(`${API_BASE_URL}/users/me`, ({ request }) => {
        const auth = request.headers.get('Authorization')
        if (auth === `Bearer ${TOKENS.access}`) {
          originalTokenUses += 1
          if (originalTokenUses === 1) return HttpResponse.json(CURRENT_USER)
        }
        return HttpResponse.json({ detail: 'Unauthorized' }, { status: 401 })
      }),
      refreshFailsHandler(),
    )

    await login(VALID_CREDENTIALS.email, VALID_CREDENTIALS.password)
    const { queryClient } = renderApp('/')

    await expect(
      queryClient.fetchQuery({ queryKey: ['probe'], queryFn: () => apiFetch('/users/me') }),
    ).rejects.toThrow('Your session has expired.')

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument()
    expect(await screen.findByRole('status')).toHaveTextContent('Your session ended. Please log in again.')
  })
})

describe('logout', () => {
  it('clears the session and returns to /login', async () => {
    server.use(loginHandler(), currentUserHandler([TOKENS.access]), listProjectsHandler())
    await login(VALID_CREDENTIALS.email, VALID_CREDENTIALS.password)
    const user = userEvent.setup()
    renderApp('/')

    await user.click(await screen.findByRole('button', { name: 'Log out' }))

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument()
    expect(localStorage.getItem('testops-hub.refresh-token')).toBeNull()
  })
})
