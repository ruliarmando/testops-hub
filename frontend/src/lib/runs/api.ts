import { apiFetch } from '@/lib/api/client'
import type { components } from '@/api/schema'

export type RunSummary = components['schemas']['TestRunSummary']

export function listRunsRequest(projectId: string): Promise<RunSummary[]> {
  return apiFetch<RunSummary[]>(`/projects/${projectId}/runs`)
}
