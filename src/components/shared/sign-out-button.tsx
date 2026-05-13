'use client'

import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth-client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

export const SignOutButton = () => {
  const [isPending, setIsPending] = useState(false)
  const router = useRouter()

  async function handleClick() {
    await authClient.signOut({
      fetchOptions: {
        onRequest: () => {
          setIsPending(true)
        },
        onResponse: () => {
          setIsPending(false)
        },
        onError: ctx => {
          toast.error(ctx.error.message)
        },
        onSuccess: () => {
          toast.success('You’ve logged out. See you soon!', {
            duration: 5000
          })
          router.push('/')
        }
      }
    })
  }

  return (
    <Button
      onClick={handleClick}
      size='sm'
      className='bg-red-500'
      disabled={isPending}
    >
      Sign out
    </Button>
  )
}
