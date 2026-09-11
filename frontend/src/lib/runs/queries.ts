import { useQuery } from '@tanstack/react-query'

import { listRunsRequest } from './api'

export function runsQueryKey(projectId: string) {
  return ['projects', projectId, 'runs'] as const
}

export function useProjectRuns(projectId: string) {
  return useQuery({
    queryKey: runsQueryKey(projectId),
    queryFn: () => listRunsRequest(projectId),
  })
}
