// src/app/(site)/onboarding/opening-balances/_components/save-opening-balances-button.tsx

'use client'

import { Loader2 } from 'lucide-react'
import { useFormStatus } from 'react-dom'

import { Button } from '@/components/ui/button'

export function SaveOpeningBalancesButton() {
  const { pending } = useFormStatus()

  return (
    <Button type='submit' disabled={pending}>
      {pending ? (
        <>
          <Loader2 className='mr-2 h-4 w-4 animate-spin' />
          Saving...
        </>
      ) : (
        'Save opening balances'
      )}
    </Button>
  )
}
