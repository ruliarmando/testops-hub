import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'

import { SessionExpiredError } from './lib/api/client'
import { router, type AppRouter } from './router'

/**
 * Factory (rather than a bare component) so tests can wire an isolated router + query
 * client per test, and drive queries through the same client that owns the
 * session-expiry redirect below.
 */
export function createApp(router: AppRouter) {
  const queryClient = new QueryClient({
    defaultOptions: {
      // apiFetch already refreshes-and-retries once on a 401; a query-level retry would just repeat that cycle.
      queries: { retry: false },
    },
    queryCache: new QueryCache({
      onError: (error) => {
        if (error instanceof SessionExpiredError) {
          void router.navigate({
            to: '/login',
            search: { redirect: router.state.location.href, reason: 'session-expired' },
          })
        }
      },
    }),
  })

  function App() {
    return (
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    )
  }

  return { App, queryClient }
}

const { App } = createApp(router)

export default App
