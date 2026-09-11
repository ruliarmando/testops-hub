import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryHistory } from '@tanstack/react-router'
import { afterEach, describe, expect, it } from 'vitest'

import { createApp } from '@/App'
import { login, logout } from '@/lib/auth/store'
import { createAppRouter } from '@/router'
import { server } from '@/test/msw/server'
import {
  PROJECTS,
  TOKENS,
  VALID_CREDENTIALS,
  currentUserHandler,
  listProjectsHandler,
  listRunsHandler,
  loginHandler,
  projectsCrudHandlers,
} from '@/test/msw/handlers'

afterEach(() => {
  logout()
})

function renderApp(initialPath: string) {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [initialPath] }))
  const { App } = createApp(router)
  render(<App />)
  return { router }
}

async function loginAndRenderProjects() {
  server.use(loginHandler(), currentUserHandler([TOKENS.access]))
  await login(VALID_CREDENTIALS.email, VALID_CREDENTIALS.password)
  return renderApp('/projects')
}

describe('projects list', () => {
  it('renders every project the user owns', async () => {
    server.use(listProjectsHandler())
    await loginAndRenderProjects()

    expect(await screen.findByRole('link', { name: PROJECTS[0].name })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: PROJECTS[1].name })).toBeInTheDocument()
  })

  it('shows an empty state when the user has no projects yet', async () => {
    server.use(listProjectsHandler([]))
    await loginAndRenderProjects()

    expect(await screen.findByText(/don't have any projects yet/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: PROJECTS[0].name })).not.toBeInTheDocument()
  })

  it('clicking a project navigates to its dashboard route', async () => {
    server.use(listProjectsHandler(), listRunsHandler(PROJECTS[0].id, []))
    const user = userEvent.setup()
    const { router } = await loginAndRenderProjects()

    await user.click(await screen.findByRole('link', { name: PROJECTS[0].name }))

    expect(await screen.findByText('Project dashboard')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(`/projects/${PROJECTS[0].id}`)
  })
})

describe('project creation', () => {
  it('creates a project and shows it in the list without a manual refresh', async () => {
    server.use(...projectsCrudHandlers([PROJECTS[0]]))
    const user = userEvent.setup()
    await loginAndRenderProjects()

    expect(await screen.findByRole('link', { name: PROJECTS[0].name })).toBeInTheDocument()

    await user.type(screen.getByLabelText('New project name'), 'New Project')
    await user.click(screen.getByRole('button', { name: 'Create project' }))

    expect(await screen.findByRole('link', { name: 'New Project' })).toBeInTheDocument()
    expect(screen.getByLabelText('New project name')).toHaveValue('')
  })

  it('shows a validation error and makes no request when submitting an empty name', async () => {
    server.use(listProjectsHandler())
    const user = userEvent.setup()
    await loginAndRenderProjects()

    await screen.findByRole('link', { name: PROJECTS[0].name })
    await user.click(screen.getByRole('button', { name: 'Create project' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Project name is required')
  })
})
