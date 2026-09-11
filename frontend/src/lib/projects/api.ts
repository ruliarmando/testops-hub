import { apiFetch } from '@/lib/api/client'
import type { components } from '@/api/schema'

export type Project = components['schemas']['ProjectRead']
export type ProjectCreateInput = components['schemas']['ProjectCreate']

export function listProjectsRequest(): Promise<Project[]> {
  return apiFetch<Project[]>('/projects')
}

export function createProjectRequest(input: ProjectCreateInput): Promise<Project> {
  return apiFetch<Project>('/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}
