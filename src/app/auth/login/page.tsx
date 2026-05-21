// src/app/auth/login/page.tsx

import { Suspense } from 'react'
import type { Metadata } from 'next'
import LoginForm from './_components/login-form'
import { branding } from '@/lib/branding'

export const metadata: Metadata = {
  title: `Log in - ${branding.appName}`
}

type LoginPageProps = {
  searchParams?: Promise<{
    next?: string
    error?: string
  }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams

  return (
    <Suspense fallback={null}>
      <LoginForm next={params?.next} error={params?.error} />
    </Suspense>
  )
}
