'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { signUp } from '@/lib/auth-client'
import { BackButton } from '@/components/shared/back-button'
import { ArrowBigRight } from 'lucide-react'

export default function RegisterForm() {
  const router = useRouter()

  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setPending(true)

    const formData = new FormData(event.currentTarget)

    const email = String(formData.get('email') ?? '')
    const password = String(formData.get('password') ?? '')
    const councilName = String(formData.get('councilName') ?? '')

    const result = await signUp.email({
      email,
      password,
      name: email
    })

    if (result.error) {
      setPending(false)
      setError(result.error.message ?? 'Registration failed.')
      return
    }

    const onboardRes = await fetch('/api/onboarding/create-parish-council', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ councilName })
    })

    setPending(false)

    if (!onboardRes.ok) {
      const data = await onboardRes.json().catch(() => null)
      setError(data?.error ?? 'Account created, but council setup failed.')
      return
    }

    router.push('/')
  }

  return (
    <main className='flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6'>
      <form
        className='w-full max-w-md rounded-xl bg-white p-8 shadow-sm'
        onSubmit={handleSubmit}
      >
        <h1 className='text-2xl font-semibold'>Create account</h1>

        {error && (
          <p className='mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700'>
            {error}
          </p>
        )}

        <div className='mt-6 space-y-4'>
          <input
            name='councilName'
            type='text'
            required
            placeholder='Parish council name'
            className='w-full rounded-md border px-3 py-2'
          />

          <input
            name='email'
            type='email'
            required
            placeholder='Email'
            className='w-full rounded-md border px-3 py-2'
          />

          <input
            name='password'
            type='password'
            required
            placeholder='Password'
            className='w-full rounded-md border px-3 py-2'
          />
        </div>

        <button
          type='submit'
          disabled={pending}
          className='mt-6 w-full rounded-md bg-zinc-950 px-4 py-2 text-white'
        >
          {pending ? 'Creating...' : 'Create account'}
        </button>

        <p className='mt-4 text-sm'>
          Already have an account?{' '}
          <Link href='/auth/login' className='font-medium'>
            Log in
          </Link>
        </p>
      </form>
      <div className='flex items-center p-2'>
        <BackButton title='Back' variant='outline' className='' />
        <ArrowBigRight className='h-4 w-4' />
      </div>
    </main>
  )
}
