'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowBigRight } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

import { signIn } from '@/lib/auth-client'
import { BackButton } from '@/components/shared/back-button'

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email is required.')
    .check(z.email())
    .toLowerCase(),
  password: z.string().min(1, 'Password is required.')
})

type LoginFormValues = z.infer<typeof loginSchema>

type Props = {
  next?: string
  error?: string
}

export default function LoginForm({ next, error: initialError }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const registered = searchParams.get('registered')

  const safeNext =
    next && next.startsWith('/') && !next.startsWith('//')
      ? next
      : '/transactions/inbox'

  const [error, setError] = useState<string | null>(initialError ?? null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: ''
    }
  })

  async function onSubmit(values: LoginFormValues) {
    setError(null)

    try {
      const result = await signIn.email({
        email: values.email,
        password: values.password
      })

      if (result.error) {
        setError(result.error.message ?? 'Login failed.')
        return
      }

      router.push(safeNext)
      router.refresh()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong. Please try again.'
      )
    }
  }

  return (
    <main className='flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6'>
      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className='w-full max-w-md rounded-xl bg-white p-8 shadow-sm'
      >
        <h1 className='text-2xl font-semibold'>Log in</h1>

        {registered && (
          <p className='mt-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700'>
            Account created. You can now log in.
          </p>
        )}

        {initialError === 'missing-council' && (
          <p className='mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700'>
            Your account is not linked to a parish council. Please log in again
            or contact support.
          </p>
        )}

        {next && (
          <p className='mt-4 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700'>
            Your session expired. Please log in to continue.
          </p>
        )}

        {error && initialError !== 'missing-council' && (
          <p className='mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700'>
            {error}
          </p>
        )}

        <div className='mt-6 space-y-4'>
          <div>
            <input
              {...register('email')}
              type='email'
              placeholder='Email'
              autoComplete='email'
              className='w-full rounded-md border px-3 py-2'
            />
            {errors.email && (
              <p className='mt-1 text-sm text-red-600'>
                {errors.email.message}
              </p>
            )}
          </div>

          <div>
            <input
              {...register('password')}
              type='password'
              placeholder='Password'
              autoComplete='current-password'
              className='w-full rounded-md border px-3 py-2'
            />
            {errors.password && (
              <p className='mt-1 text-sm text-red-600'>
                {errors.password.message}
              </p>
            )}
          </div>
        </div>

        <button
          type='submit'
          disabled={isSubmitting}
          className='mt-6 w-full rounded-md bg-zinc-950 px-4 py-2 text-white disabled:opacity-50'
        >
          {isSubmitting ? 'Logging in...' : 'Log in'}
        </button>

        <p className='mt-4 text-sm text-zinc-600'>
          Need an account?{' '}
          <Link href='/auth/register' className='font-medium text-zinc-950'>
            Register
          </Link>
        </p>
      </form>

      <div className='flex items-center p-2'>
        <BackButton title='Back' variant='outline' />
        <ArrowBigRight className='h-4 w-4' />
      </div>
    </main>
  )
}
