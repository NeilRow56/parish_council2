'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowBigRight } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

import { signUp } from '@/lib/auth-client'
import { BackButton } from '@/components/shared/back-button'

const registerSchema = z.object({
  councilName: z
    .string()
    .trim()
    .min(1, 'Parish council name is required.')
    .max(160, 'Parish council name must be 160 characters or fewer.'),

  email: z
    .string()
    .trim()
    .min(1, 'Email is required.')
    .check(z.email('Enter a valid email address.'))
    .toLowerCase(),

  password: z.string().min(10, 'Password must be at least 10 characters.')
})

type RegisterFormValues = z.infer<typeof registerSchema>

export default function RegisterForm() {
  const router = useRouter()

  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      councilName: '',
      email: '',
      password: ''
    }
  })

  async function onSubmit(values: RegisterFormValues) {
    setError(null)

    try {
      const result = await signUp.email({
        email: values.email,
        password: values.password,
        name: values.email
      })

      if (result.error) {
        setError(result.error.message ?? 'Registration failed.')
        return
      }

      const onboardRes = await fetch('/api/onboarding/create-parish-council', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          councilName: values.councilName
        })
      })

      if (!onboardRes.ok) {
        const data = await onboardRes.json().catch(() => null)
        setError(data?.error ?? 'Account created, but council setup failed.')
        return
      }

      router.push('/')
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
        className='w-full max-w-md rounded-xl bg-white p-8 shadow-sm'
        onSubmit={handleSubmit(onSubmit)}
        noValidate
      >
        <h1 className='text-2xl font-semibold'>Create account</h1>

        {error && (
          <p className='mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700'>
            {error}
          </p>
        )}

        <div className='mt-6 space-y-4'>
          <div>
            <input
              {...register('councilName')}
              type='text'
              placeholder='Parish council name'
              autoComplete='organization'
              className='w-full rounded-md border px-3 py-2'
            />
            {errors.councilName && (
              <p className='mt-1 text-sm text-red-600'>
                {errors.councilName.message}
              </p>
            )}
          </div>

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
              autoComplete='new-password'
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
          {isSubmitting ? 'Creating...' : 'Create account'}
        </button>

        <p className='mt-4 text-sm'>
          Already have an account?{' '}
          <Link href='/auth/login' className='font-medium'>
            Log in
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
