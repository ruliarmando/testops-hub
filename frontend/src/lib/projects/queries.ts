import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { createProjectRequest, listProjectsRequest, type ProjectCreateInput } from './api'

export const projectsQueryKey = ['projects'] as const

export function useProjects() {
  return useQuery({ queryKey: projectsQueryKey, queryFn: listProjectsRequest })
}

export function useCreateProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: ProjectCreateInput) => createProjectRequest(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectsQueryKey })
    },
  })
}
