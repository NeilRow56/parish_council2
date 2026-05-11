'use client'

import { useState, useTransition } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'

import { createBorrowing } from '../actions'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

type BorrowingNominalCode = {
  id: string
  code: string
  name: string
}

type AddBorrowingDialogProps = {
  financialYearId: string
  nominalCodes: BorrowingNominalCode[]
}

export function AddBorrowingDialog({
  financialYearId,
  nominalCodes
}: AddBorrowingDialogProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const defaultNominalCodeId = nominalCodes[0]?.id ?? ''

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await createBorrowing(formData)
        toast.success('Borrowing added')
        setOpen(false)
      } catch {
        toast.error('Could not add borrowing')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className='bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium shadow disabled:pointer-events-none disabled:opacity-50'>
        <Plus className='h-4 w-4' />
        Add loan
      </DialogTrigger>

      <DialogContent className='sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>Add loan</DialogTitle>
          <DialogDescription>
            Add the loan details to the borrowings register. Opening balances
            are still maintained separately through nominal opening balances.
          </DialogDescription>
        </DialogHeader>

        <form action={handleSubmit} className='space-y-5'>
          <input type='hidden' name='financialYearId' value={financialYearId} />

          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor='lender'>Lender</Label>
              <Input
                id='lender'
                name='lender'
                placeholder='e.g. PWLB'
                required
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='reference'>Reference</Label>
              <Input
                id='reference'
                name='reference'
                placeholder='Loan reference'
              />
            </div>

            <div className='space-y-2 sm:col-span-2'>
              <Label htmlFor='purpose'>Purpose</Label>
              <Input
                id='purpose'
                name='purpose'
                placeholder='e.g. Pavilion refurbishment'
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='startDate'>Start date</Label>
              <Input id='startDate' name='startDate' type='date' />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='originalAmount'>Original amount</Label>
              <Input
                id='originalAmount'
                name='originalAmount'
                type='number'
                min='0'
                step='0.01'
                placeholder='0.00'
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='interestRate'>Interest rate %</Label>
              <Input
                id='interestRate'
                name='interestRate'
                type='number'
                min='0'
                step='0.001'
                placeholder='0.000'
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='repaymentFrequency'>Repayment frequency</Label>
              <Input
                id='repaymentFrequency'
                name='repaymentFrequency'
                placeholder='e.g. Monthly, quarterly, annual'
              />
            </div>

            <div className='space-y-2 sm:col-span-2'>
              <Label htmlFor='nominalCodeId'>Borrowings nominal code</Label>
              <Select name='nominalCodeId' defaultValue={defaultNominalCodeId}>
                <SelectTrigger id='nominalCodeId'>
                  <SelectValue placeholder='Select nominal code' />
                </SelectTrigger>
                <SelectContent>
                  {nominalCodes.map(code => (
                    <SelectItem key={code.id} value={code.id}>
                      {code.code} {code.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-2 sm:col-span-2'>
              <Label htmlFor='notes'>Notes</Label>
              <Textarea
                id='notes'
                name='notes'
                placeholder='Optional notes about the loan'
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type='submit' disabled={isPending}>
              {isPending ? 'Adding...' : 'Add loan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
