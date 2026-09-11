import { useParams } from '@tanstack/react-router'

export function RunDetailPage() {
  const { projectId, runId } = useParams({ from: '/authenticated/projects/$projectId/runs/$runId' })

  return (
    <div>
      <p>Run detail coming soon.</p>
      <p className="text-sm text-muted-foreground">
        Project ID: {projectId} — Run ID: {runId}
      </p>
    </div>
  )
}
