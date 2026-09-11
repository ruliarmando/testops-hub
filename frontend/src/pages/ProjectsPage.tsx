import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCreateProject, useProjects } from '@/lib/projects/queries'

const createProjectFormSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
})

type CreateProjectFormValues = z.infer<typeof createProjectFormSchema>

export function ProjectsPage() {
  const { data: projects, isPending, isError } = useProjects()
  const createProject = useCreateProject()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateProjectFormValues>({ resolver: zodResolver(createProjectFormSchema) })

  const onSubmit = async (values: CreateProjectFormValues) => {
    try {
      await createProject.mutateAsync({ name: values.name })
      reset()
    } catch {
      // surfaced below via createProject.isError
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <h2 className="text-xl font-semibold">Projects</h2>

      <form className="flex items-end gap-3" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="project-name">New project name</Label>
          <Input id="project-name" {...register('name')} />
          {errors.name && (
            <p role="alert" className="text-sm text-destructive">
              {errors.name.message}
            </p>
          )}
        </div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating…' : 'Create project'}
        </Button>
      </form>

      {createProject.isError && (
        <p role="alert" className="text-sm text-destructive">
          Something went wrong creating the project. Please try again.
        </p>
      )}

      {isPending && <p className="text-sm text-muted-foreground">Loading projects…</p>}

      {isError && (
        <p role="alert" className="text-sm text-destructive">
          Couldn't load projects. Please try again.
        </p>
      )}

      {projects && projects.length === 0 && (
        <p className="text-sm text-muted-foreground">
          You don't have any projects yet. Create one above to get started.
        </p>
      )}

      {projects && projects.length > 0 && (
        <ul className="flex flex-col gap-2">
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                to="/projects/$projectId"
                params={{ projectId: project.id }}
                className="block rounded-md border p-4 hover:bg-muted"
              >
                {project.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
