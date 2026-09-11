import { fireEvent, render, screen, within } from '@testing-library/react'
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
  listRunsHandler,
  loginHandler,
  makeRun,
  type RunFixture,
} from '@/test/msw/handlers'

afterEach(() => {
  logout()
})

const projectId = PROJECTS[0].id

function renderApp(initialPath: string) {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [initialPath] }))
  const { App } = createApp(router)
  render(<App />)
  return { router }
}

async function loginAndRenderDashboard() {
  server.use(loginHandler(), currentUserHandler([TOKENS.access]))
  await login(VALID_CREDENTIALS.email, VALID_CREDENTIALS.password)
  return renderApp(`/projects/${projectId}`)
}

async function dataRows() {
  const rows = await screen.findAllByRole('row')
  return rows.slice(1)
}

describe('project dashboard: empty states', () => {
  it('shows a dedicated empty state when the project has no runs', async () => {
    server.use(listRunsHandler(projectId, []))
    await loginAndRenderDashboard()

    expect(await screen.findByText(/No runs have been ingested for this project yet/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Branch')).not.toBeInTheDocument()
    expect(screen.queryAllByTestId('chart-point')).toHaveLength(0)
  })

  it('shows a message when filters produce no matching runs, without affecting the chart', async () => {
    const runs = [
      makeRun({ created_at: '2026-01-01T10:00:00Z', run_metadata: { branch: 'main' }, pass_rate: 100 }),
      makeRun({ created_at: '2026-01-02T10:00:00Z', run_metadata: { branch: 'main' }, pass_rate: 80 }),
    ]
    server.use(listRunsHandler(projectId, runs))
    await loginAndRenderDashboard()

    expect(await screen.findAllByTestId('chart-point')).toHaveLength(2)

    fireEvent.change(screen.getByLabelText('Branch'), { target: { value: 'other-branch' } })

    expect(await screen.findByText('No runs match your filters.')).toBeInTheDocument()
    expect(screen.getAllByTestId('chart-point')).toHaveLength(2)
  })
})

describe('project dashboard: run history table', () => {
  const runs: RunFixture[] = [
    makeRun({ created_at: '2026-01-01T10:00:00Z', run_metadata: { branch: 'main' }, pass_rate: 10 }),
    makeRun({ created_at: '2026-01-02T10:00:00Z', run_metadata: { branch: 'main' }, pass_rate: 40 }),
    makeRun({ created_at: '2026-01-03T10:00:00Z', run_metadata: { branch: 'feature-x' }, pass_rate: 70 }),
    makeRun({ created_at: '2026-01-04T10:00:00Z', run_metadata: { branch: 'feature-x' }, pass_rate: 90 }),
  ]

  it('sorts by most recent run first by default', async () => {
    server.use(listRunsHandler(projectId, runs))
    await loginAndRenderDashboard()

    const rows = await dataRows()
    const passRates = rows.map((row) => within(row).getAllByRole('cell')[1].textContent)
    expect(passRates).toEqual(['90.0%', '70.0%', '40.0%', '10.0%'])
  })

  it('toggles sort order when the pass rate column header is clicked', async () => {
    // pass_rate deliberately not correlated with created_at, so sorting by each column is distinguishable.
    const unorderedRuns = [
      makeRun({ created_at: '2026-01-01T10:00:00Z', pass_rate: 70 }),
      makeRun({ created_at: '2026-01-02T10:00:00Z', pass_rate: 10 }),
      makeRun({ created_at: '2026-01-03T10:00:00Z', pass_rate: 90 }),
      makeRun({ created_at: '2026-01-04T10:00:00Z', pass_rate: 40 }),
    ]
    server.use(listRunsHandler(projectId, unorderedRuns))
    const user = userEvent.setup()
    await loginAndRenderDashboard()
    await dataRows()

    // Numeric columns sort descending on the first click (TanStack Table's default for non-string columns).
    await user.click(screen.getByRole('button', { name: /Pass rate/ }))
    let passRates = (await dataRows()).map((row) => within(row).getAllByRole('cell')[1].textContent)
    expect(passRates).toEqual(['90.0%', '70.0%', '40.0%', '10.0%'])

    await user.click(screen.getByRole('button', { name: /Pass rate/ }))
    passRates = (await dataRows()).map((row) => within(row).getAllByRole('cell')[1].textContent)
    expect(passRates).toEqual(['10.0%', '40.0%', '70.0%', '90.0%'])
  })

  it('filters by branch', async () => {
    server.use(listRunsHandler(projectId, runs))
    await loginAndRenderDashboard()
    await dataRows()

    fireEvent.change(screen.getByLabelText('Branch'), { target: { value: 'feature-x' } })

    const rows = await dataRows()
    expect(rows).toHaveLength(2)
    for (const row of rows) {
      expect(within(row).getAllByRole('cell')[2].textContent).toBe('feature-x')
    }
  })

  it('filters by date range', async () => {
    server.use(listRunsHandler(projectId, runs))
    await loginAndRenderDashboard()
    await dataRows()

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-01-02' } })
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-01-03' } })

    const rows = await dataRows()
    const passRates = rows.map((row) => within(row).getAllByRole('cell')[1].textContent)
    expect(passRates.sort()).toEqual(['40.0%', '70.0%'])
  })

  it('filters by result bucket, treating a zero-result run as "Has failures"', async () => {
    const bucketRuns = [
      makeRun({ created_at: '2026-01-01T10:00:00Z', pass_rate: 100 }),
      makeRun({ created_at: '2026-01-02T10:00:00Z', pass_rate: 50 }),
      makeRun({ created_at: '2026-01-03T10:00:00Z', pass_rate: null }),
    ]
    server.use(listRunsHandler(projectId, bucketRuns))
    await loginAndRenderDashboard()
    await dataRows()

    fireEvent.change(screen.getByLabelText('Result'), { target: { value: 'failures' } })
    let rows = await dataRows()
    expect(rows.map((row) => within(row).getAllByRole('cell')[1].textContent).sort()).toEqual(['50.0%', '—'])

    fireEvent.change(screen.getByLabelText('Result'), { target: { value: 'passed' } })
    rows = await dataRows()
    expect(rows.map((row) => within(row).getAllByRole('cell')[1].textContent)).toEqual(['100.0%'])
  })

  it('combines branch, date range, and result bucket filters with AND semantics', async () => {
    server.use(listRunsHandler(projectId, runs))
    await loginAndRenderDashboard()
    await dataRows()

    fireEvent.change(screen.getByLabelText('Branch'), { target: { value: 'feature-x' } })
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-01-04' } })
    fireEvent.change(screen.getByLabelText('Result'), { target: { value: 'failures' } })

    const rows = await dataRows()
    expect(rows).toHaveLength(1)
    expect(within(rows[0]).getAllByRole('cell')[1].textContent).toBe('90.0%')
  })

  it('navigates to the run detail page when a row is clicked', async () => {
    server.use(listRunsHandler(projectId, runs))
    const user = userEvent.setup()
    const { router } = await loginAndRenderDashboard()

    const rows = await dataRows()
    await user.click(rows[0])

    expect(await screen.findByText(/Run detail coming soon/)).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(`/projects/${projectId}/runs/${runs[3].id}`)
  })
})

describe('project dashboard: pass-rate trend chart', () => {
  it('always reflects the most recent 20 runs regardless of active table filters', async () => {
    const manyRuns: RunFixture[] = Array.from({ length: 25 }, (_, index) =>
      makeRun({
        created_at: new Date(2026, 0, index + 1).toISOString(),
        run_metadata: { branch: index === 24 ? 'only-run-branch' : 'main' },
        pass_rate: 100,
      }),
    )
    server.use(listRunsHandler(projectId, manyRuns))
    await loginAndRenderDashboard()

    expect(await screen.findAllByTestId('chart-point')).toHaveLength(20)

    fireEvent.change(screen.getByLabelText('Branch'), { target: { value: 'only-run-branch' } })

    expect(await dataRows()).toHaveLength(1)
    expect(screen.getAllByTestId('chart-point')).toHaveLength(20)
  })
})
