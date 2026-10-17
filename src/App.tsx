import { RouterProvider } from 'react-router-dom'
import { ThemeProvider } from '@/app/providers/theme-provider'
import { AuthProvider } from '@/app/providers/auth-provider'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { router } from '@/app/router'

export function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App
