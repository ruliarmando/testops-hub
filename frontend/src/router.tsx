import {
  type RouterHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
  useNavigate,
} from '@tanstack/react-router'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { ensureAuthenticated, hasStoredSession } from '@/lib/auth/store'
import { useAuth } from '@/lib/auth/useAuth'
import { DashboardPage } from '@/pages/DashboardPage'
import { LoginPage } from '@/pages/LoginPage'

const rootRoute = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  const { status, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    void navigate({ to: '/login' })
  }

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="flex items-center justify-between border-b p-4">
        <h1 className="text-lg font-semibold">TestOps Hub</h1>
        {status === 'authenticated' && (
          <Button variant="outline" size="sm" onClick={handleLogout}>
            Log out
          </Button>
        )}
      </header>
      <main className="p-4">
        <Outlet />
      </main>
    </div>
  )
}

const loginSearchSchema = z.object({
  redirect: z.string().optional(),
  reason: z.literal('session-expired').optional(),
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: loginSearchSchema,
  component: LoginPage,
})

const authenticatedLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'authenticated',
  beforeLoad: async ({ location }) => {
    // Captured before ensureAuthenticated(), which clears it on a failed refresh — this
    // distinguishes "never logged in" from "had a session that expired/became invalid".
    const hadStoredSession = hasStoredSession()
    const authenticated = await ensureAuthenticated()
    if (!authenticated) {
      throw redirect({
        to: '/login',
        search: { redirect: location.href, reason: hadStoredSession ? 'session-expired' : undefined },
      })
    }
  },
  component: Outlet,
})

const indexRoute = createRoute({
  getParentRoute: () => authenticatedLayoutRoute,
  path: '/',
  component: DashboardPage,
})

const routeTree = rootRoute.addChildren([loginRoute, authenticatedLayoutRoute.addChildren([indexRoute])])

/** Used directly by main.tsx/App.tsx for the real app, and by tests to build an isolated router per test. */
export function createAppRouter(history?: RouterHistory) {
  return createRouter({ routeTree, history })
}

export const router = createAppRouter()

export type AppRouter = ReturnType<typeof createAppRouter>

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
