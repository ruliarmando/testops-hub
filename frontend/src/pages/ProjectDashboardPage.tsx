import { useParams } from '@tanstack/react-router'

export function ProjectDashboardPage() {
  const { projectId } = useParams({ from: '/authenticated/projects/$projectId' })

  return (
    <div>
      <p>Project dashboard coming soon.</p>
      <p className="text-sm text-muted-foreground">Project ID: {projectId}</p>
    </div>
  )
}
