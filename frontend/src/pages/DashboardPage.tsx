import { useAuth } from '@/lib/auth/useAuth'

export function DashboardPage() {
  const { user } = useAuth()

  return (
    <div>
      <p>Dashboard coming soon.</p>
      {user && <p className="text-sm text-muted-foreground">Logged in as {user.email}</p>}
    </div>
  )
}
