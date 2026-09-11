import type { RunSummary } from './api'

export type ResultBucket = 'passed' | 'failures'

export type ResultBucketFilter = 'all' | ResultBucket

export interface RunFilters {
  branch: string | 'all'
  dateFrom: string | null
  dateTo: string | null
  resultBucket: ResultBucketFilter
}

export const defaultRunFilters: RunFilters = {
  branch: 'all',
  dateFrom: null,
  dateTo: null,
  resultBucket: 'all',
}

/** Chart windowing (last 20 runs by created_at) is independent of table filters, per issue #12 story 16. */
export const CHART_WINDOW_SIZE = 20

export function getBranch(run: RunSummary): string | null {
  const branch = run.run_metadata?.branch
  return typeof branch === 'string' && branch.length > 0 ? branch : null
}

/** A zero-result run (pass_rate === null) counts as "Has failures", per CONTEXT.md's Result bucket definition. */
export function getResultBucket(run: RunSummary): ResultBucket {
  return run.pass_rate === 100 ? 'passed' : 'failures'
}

export function deriveBranchOptions(runs: RunSummary[]): string[] {
  const branches = new Set<string>()
  for (const run of runs) {
    const branch = getBranch(run)
    if (branch) branches.add(branch)
  }
  return [...branches].sort((a, b) => a.localeCompare(b))
}

export function filterRuns(runs: RunSummary[], filters: RunFilters): RunSummary[] {
  return runs.filter((run) => {
    if (filters.branch !== 'all' && getBranch(run) !== filters.branch) return false

    if (filters.dateFrom && new Date(run.created_at) < new Date(`${filters.dateFrom}T00:00:00`)) return false
    if (filters.dateTo && new Date(run.created_at) > new Date(`${filters.dateTo}T23:59:59.999`)) return false

    if (filters.resultBucket !== 'all' && getResultBucket(run) !== filters.resultBucket) return false

    return true
  })
}

/** Most recent CHART_WINDOW_SIZE runs, oldest-first so the trend line reads left-to-right chronologically. */
export function selectChartRuns(runs: RunSummary[]): RunSummary[] {
  return [...runs]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, CHART_WINDOW_SIZE)
    .reverse()
}
