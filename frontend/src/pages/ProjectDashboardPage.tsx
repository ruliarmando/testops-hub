import { useMemo, useState } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table'
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis, type DotProps } from 'recharts'

import { Label } from '@/components/ui/label'
import { useProjectRuns } from '@/lib/runs/queries'
import type { RunSummary } from '@/lib/runs/api'
import {
  defaultRunFilters,
  deriveBranchOptions,
  filterRuns,
  getBranch,
  selectChartRuns,
  type RunFilters,
} from '@/lib/runs/dashboard'

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString()
}

function formatPassRate(passRate: number | null): string {
  return passRate === null ? '—' : `${passRate.toFixed(1)}%`
}

const columnHelper = createColumnHelper<RunSummary>()

const columns = [
  columnHelper.accessor('created_at', {
    id: 'created_at',
    header: 'Created',
    cell: (info) => formatDateTime(info.getValue()),
  }),
  columnHelper.accessor('pass_rate', {
    id: 'pass_rate',
    header: 'Pass rate',
    cell: (info) => formatPassRate(info.getValue()),
  }),
  columnHelper.accessor((row) => getBranch(row), {
    id: 'branch',
    header: 'Branch',
    cell: (info) => info.getValue() ?? '—',
  }),
]

function ChartDot(props: DotProps & { payload?: RunSummary }) {
  const { cx, cy, payload } = props
  if (cx == null || cy == null || !payload) return null
  return <circle data-testid="chart-point" data-run-id={payload.id} cx={cx} cy={cy} r={3} fill="currentColor" />
}

export function ProjectDashboardPage() {
  const { projectId } = useParams({ from: '/authenticated/projects/$projectId' })
  const navigate = useNavigate()
  const { data: runs, isPending, isError } = useProjectRuns(projectId)

  const [filters, setFilters] = useState<RunFilters>(defaultRunFilters)
  const [sorting, setSorting] = useState<SortingState>([{ id: 'created_at', desc: true }])

  const branchOptions = useMemo(() => (runs ? deriveBranchOptions(runs) : []), [runs])
  const filteredRuns = useMemo(() => (runs ? filterRuns(runs, filters) : []), [runs, filters])
  const chartRuns = useMemo(() => (runs ? selectChartRuns(runs) : []), [runs])

  const table = useReactTable({
    data: filteredRuns,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const goToRun = (runId: string) => {
    void navigate({ to: '/projects/$projectId/runs/$runId', params: { projectId, runId } })
  }

  if (isPending) {
    return <p className="text-sm text-muted-foreground">Loading runs…</p>
  }

  if (isError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        Couldn't load run history. Please try again.
      </p>
    )
  }

  if (runs.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Project dashboard</h2>
        <p className="text-sm text-muted-foreground">
          No runs have been ingested for this project yet. Once your test reporter starts sending results, they'll
          show up here.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <h2 className="text-xl font-semibold">Project dashboard</h2>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-muted-foreground">Pass rate trend (last {chartRuns.length} runs)</h3>
        <div className="overflow-x-auto">
          <LineChart width={640} height={240} data={chartRuns}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="created_at" tickFormatter={(value: string) => new Date(value).toLocaleDateString()} />
            <YAxis domain={[0, 100]} unit="%" />
            <Tooltip
              formatter={(value) => formatPassRate(typeof value === 'number' ? value : null)}
              labelFormatter={(value: string) => formatDateTime(value)}
            />
            <Line type="monotone" dataKey="pass_rate" connectNulls dot={<ChartDot />} />
          </LineChart>
        </div>
      </section>

      <section className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="branch-filter">Branch</Label>
          <select
            id="branch-filter"
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={filters.branch}
            onChange={(event) => setFilters((prev) => ({ ...prev, branch: event.target.value }))}
          >
            <option value="all">All branches</option>
            {branchOptions.map((branch) => (
              <option key={branch} value={branch}>
                {branch}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="date-from-filter">From</Label>
          <input
            id="date-from-filter"
            type="date"
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={filters.dateFrom ?? ''}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, dateFrom: event.target.value || null }))
            }
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="date-to-filter">To</Label>
          <input
            id="date-to-filter"
            type="date"
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={filters.dateTo ?? ''}
            onChange={(event) => setFilters((prev) => ({ ...prev, dateTo: event.target.value || null }))}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="result-filter">Result</Label>
          <select
            id="result-filter"
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={filters.resultBucket}
            onChange={(event) =>
              setFilters((prev) => ({
                ...prev,
                resultBucket: event.target.value as RunFilters['resultBucket'],
              }))
            }
          >
            <option value="all">All results</option>
            <option value="passed">All passed</option>
            <option value="failures">Has failures</option>
          </select>
        </div>
      </section>

      {filteredRuns.length === 0 ? (
        <p className="text-sm text-muted-foreground">No runs match your filters.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b text-left">
                {headerGroup.headers.map((header) => {
                  const sortDirection = header.column.getIsSorted()
                  return (
                    <th key={header.id} className="p-2 font-medium">
                      <button
                        type="button"
                        className="flex items-center gap-1"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sortDirection === 'asc' && <span aria-hidden>▲</span>}
                        {sortDirection === 'desc' && <span aria-hidden>▼</span>}
                      </button>
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="cursor-pointer border-b hover:bg-muted"
                tabIndex={0}
                onClick={() => goToRun(row.original.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    goToRun(row.original.id)
                  }
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="p-2">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
