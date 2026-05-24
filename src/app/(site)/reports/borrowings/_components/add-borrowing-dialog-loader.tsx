'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { AddBorrowingDialogProps } from './add-borrowing-dialog'

const LazyAddBorrowingDialog = dynamic<AddBorrowingDialogProps>(
  () =>
    import('./add-borrowing-dialog').then(module => module.AddBorrowingDialog),
  {
    ssr: false,
    loading: () => null
  }
)

export function AddBorrowingDialogLoader({
  financialYearId,
  nominalCodes
}: Pick<AddBorrowingDialogProps, 'financialYearId' | 'nominalCodes'>) {
  const [open, setOpen] = useState(false)
  const [hasRequestedDialog, setHasRequestedDialog] = useState(false)

  return (
    <>
      <Button
        type='button'
        onClick={() => {
          setHasRequestedDialog(true)
          setOpen(true)
        }}
      >
        <Plus className='h-4 w-4' />
        Add loan
      </Button>

      {hasRequestedDialog ? (
        <LazyAddBorrowingDialog
          financialYearId={financialYearId}
          nominalCodes={nominalCodes}
          open={open}
          onOpenChange={setOpen}
        />
      ) : null}
    </>
  )
}
