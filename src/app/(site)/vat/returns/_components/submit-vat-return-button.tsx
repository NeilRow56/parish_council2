// app/(app)/vat/returns/_components/submit-vat-return-button.tsx
'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog'

import { submitVatReturn } from '../actions'

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP'
  }).format(value)
}

export function SubmitVatReturnButton({
  financialYearId,
  periodStart,
  periodEnd,
  netVat
}: {
  financialYearId: string
  periodStart: string
  periodEnd: string
  netVat: number
}) {
  const [isPending, startTransition] = useTransition()

  function handleSubmit() {
    startTransition(async () => {
      try {
        await submitVatReturn({
          financialYearId,
          periodStart: new Date(periodStart),
          periodEnd: new Date(periodEnd)
        })

        toast.success('VAT return submitted')
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not submit VAT return'
        )
      }
    })
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        disabled={isPending}
        className='bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center justify-center rounded-md px-4 py-2 text-sm font-medium shadow transition-colors disabled:pointer-events-none disabled:opacity-50'
      >
        {isPending ? 'Submitting...' : 'Submit VAT return'}
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Submit VAT return?</AlertDialogTitle>

          <AlertDialogDescription>
            This will lock in the VAT totals for this period and post a journal
            clearing input and output VAT to VAT Control. Net VAT:{' '}
            <strong>{formatMoney(netVat)}</strong>.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleSubmit} disabled={isPending}>
            {isPending ? 'Submitting...' : 'Submit return'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
