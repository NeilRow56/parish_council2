import { Suspense } from 'react'
import type { Metadata } from 'next'
import RegisterForm from './_components/register-form'
import { branding } from '@/lib/branding'

export const metadata: Metadata = {
  title: `Create account - ${branding.appName}`
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  )
}
