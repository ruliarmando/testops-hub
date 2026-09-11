import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { InvalidCredentialsError } from '@/lib/auth/api'
import { login } from '@/lib/auth/store'

const loginFormSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

type LoginFormValues = z.infer<typeof loginFormSchema>

export function LoginPage() {
  const navigate = useNavigate()
  const search = useSearch({ from: '/login' })
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginFormSchema) })

  const onSubmit = async (values: LoginFormValues) => {
    setSubmitError(null)
    try {
      await login(values.email, values.password)
      await navigate({ to: search.redirect ?? '/' })
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        setSubmitError(error.message)
      } else {
        setSubmitError('Something went wrong. Please try again.')
      }
    }
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6">
      <h2 className="text-xl font-semibold">Log in</h2>

      {search.reason === 'session-expired' && (
        <p role="status" className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
          Your session ended. Please log in again.
        </p>
      )}

      <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="username" {...register('email')} />
          {errors.email && (
            <p role="alert" className="text-sm text-destructive">
              {errors.email.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="current-password" {...register('password')} />
          {errors.password && (
            <p role="alert" className="text-sm text-destructive">
              {errors.password.message}
            </p>
          )}
        </div>

        {submitError && (
          <p role="alert" className="text-sm text-destructive">
            {submitError}
          </p>
        )}

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Logging in…' : 'Log in'}
        </Button>
      </form>
    </div>
  )
}
