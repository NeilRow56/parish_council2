// src/app/onboarding/council-details/_components/council-onboarding-form.tsx

'use client'

import { useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { CheckCircle2, Landmark } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

type VatStatus = 'NOT_REGISTERED' | 'REGISTERED'
type VatClaimFrequency = 'ANNUAL' | 'QUARTERLY' | 'MONTHLY'

type CouncilFormInitialValues = {
  name: string
  addressLine1: string | null
  addressLine2: string | null
  town: string | null
  county: string | null
  postcode: string | null
  telephone: string | null
  email: string | null
  website: string | null
  canRecoverVat: boolean
  vatStatus: string
  vatRegistrationNumber: string | null
  vatClaimFrequency: string
}

type Props = {
  action: (formData: FormData) => void | Promise<void>
  initialValues: CouncilFormInitialValues
  submitLabel?: string
  isOnboarding?: boolean
  saved?: boolean
}

function SubmitButton({
  label,
  isDirty,
  saved
}: {
  label: string
  isDirty: boolean
  saved: boolean
}) {
  const { pending } = useFormStatus()

  return (
    <div className='space-y-2'>
      <Button type='submit' disabled={pending} className='w-full'>
        {pending ? 'Saving...' : label}
      </Button>

      <p className='text-center text-xs text-blue-600'>
        {isDirty
          ? 'You have unsaved changes.'
          : saved
            ? 'Changes saved.'
            : 'No unsaved changes.'}
      </p>
    </div>
  )
}

export function CouncilOnboardingForm({
  action,
  initialValues,
  submitLabel = 'Save changes',
  isOnboarding = false,
  saved = false
}: Props) {
  const [isDirty, setIsDirty] = useState(false)

  const [canRecoverVat, setCanRecoverVat] = useState(
    initialValues.canRecoverVat
  )
  const isSubmittingRef = useRef(false)
  const [vatStatus, setVatStatus] = useState<VatStatus>(
    initialValues.vatStatus === 'REGISTERED' ? 'REGISTERED' : 'NOT_REGISTERED'
  )

  const [vatClaimFrequency, setVatClaimFrequency] = useState<VatClaimFrequency>(
    initialValues.vatClaimFrequency === 'QUARTERLY'
      ? 'QUARTERLY'
      : initialValues.vatClaimFrequency === 'MONTHLY'
        ? 'MONTHLY'
        : 'ANNUAL'
  )

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!isDirty || isSubmittingRef.current) return

      event.preventDefault()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [isDirty])

  function markDirty() {
    setIsDirty(true)
  }

  return (
    <form
      action={action}
      onChange={markDirty}
      onSubmit={() => {
        isSubmittingRef.current = true
      }}
      className='space-y-6'
    >
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2 text-2xl font-bold'>
            <Landmark className='h-5 w-5' />
            {isOnboarding ? 'Set up your council' : 'Council details'}
          </CardTitle>
        </CardHeader>

        <CardContent className='space-y-5'>
          <div className='grid gap-2'>
            <Label htmlFor='name'>Council name</Label>
            <Input
              id='name'
              name='name'
              required
              defaultValue={initialValues.name}
            />
          </div>

          <div className='grid gap-4 md:grid-cols-2'>
            <div className='grid gap-2 md:col-span-2'>
              <Label htmlFor='addressLine1'>Address line 1</Label>
              <Input
                id='addressLine1'
                name='addressLine1'
                placeholder='100 High Street'
                defaultValue={initialValues.addressLine1 ?? ''}
              />
            </div>

            <div className='grid gap-2 md:col-span-2'>
              <Label htmlFor='addressLine2'>Address line 2</Label>
              <Input
                id='addressLine2'
                name='addressLine2'
                defaultValue={initialValues.addressLine2 ?? ''}
              />
            </div>

            <div className='grid gap-2'>
              <Label htmlFor='town'>Town</Label>
              <Input
                id='town'
                name='town'
                defaultValue={initialValues.town ?? ''}
              />
            </div>

            <div className='grid gap-2'>
              <Label htmlFor='county'>County</Label>
              <Input
                id='county'
                name='county'
                defaultValue={initialValues.county ?? ''}
              />
            </div>

            <div className='grid gap-2'>
              <Label htmlFor='postcode'>Postcode</Label>
              <Input
                id='postcode'
                name='postcode'
                placeholder='LT10 7TO'
                defaultValue={initialValues.postcode ?? ''}
              />
            </div>

            <div className='grid gap-2'>
              <Label htmlFor='telephone'>Telephone</Label>
              <Input
                id='telephone'
                name='telephone'
                defaultValue={initialValues.telephone ?? ''}
              />
            </div>

            <div className='grid gap-2'>
              <Label htmlFor='email'>Council email</Label>
              <Input
                id='email'
                name='email'
                type='email'
                defaultValue={initialValues.email ?? ''}
              />
            </div>

            <div className='grid gap-2'>
              <Label htmlFor='website'>Website</Label>
              <Input
                id='website'
                name='website'
                placeholder='https://example.gov.uk'
                defaultValue={initialValues.website ?? ''}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <CheckCircle2 className='h-5 w-5' />
            VAT recovery
          </CardTitle>
        </CardHeader>

        <CardContent className='space-y-5'>
          <input
            type='hidden'
            name='canRecoverVat'
            value={canRecoverVat ? 'on' : 'off'}
          />

          <div className='flex items-center justify-between rounded-lg border p-4'>
            <div className='space-y-1'>
              <Label htmlFor='canRecoverVat'>
                Can this council reclaim VAT?
              </Label>
              <p className='text-muted-foreground text-sm'>
                Most parish councils can reclaim VAT on eligible non-business
                purchases.
              </p>
            </div>

            <Switch
              id='canRecoverVat'
              checked={canRecoverVat}
              onCheckedChange={checked => {
                setCanRecoverVat(checked)
                markDirty()
              }}
            />
          </div>

          {canRecoverVat && (
            <>
              <div className='grid gap-2'>
                <Label htmlFor='vatStatus'>VAT status</Label>
                <Select
                  name='vatStatus'
                  value={vatStatus}
                  onValueChange={value => {
                    setVatStatus(value as VatStatus)
                    markDirty()
                  }}
                >
                  <SelectTrigger id='vatStatus'>
                    <SelectValue placeholder='Select VAT status' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='NOT_REGISTERED'>
                      Not VAT registered — reclaim using VAT126
                    </SelectItem>
                    <SelectItem value='REGISTERED'>
                      VAT registered — reclaim through VAT returns
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {vatStatus === 'REGISTERED' && (
                <div className='grid gap-2'>
                  <Label htmlFor='vatRegistrationNumber'>
                    VAT registration number
                  </Label>
                  <Input
                    id='vatRegistrationNumber'
                    name='vatRegistrationNumber'
                    defaultValue={initialValues.vatRegistrationNumber ?? ''}
                    required
                  />
                </div>
              )}

              <div className='grid gap-2'>
                <Label htmlFor='vatClaimFrequency'>VAT claim frequency</Label>
                <Select
                  name='vatClaimFrequency'
                  value={vatClaimFrequency}
                  onValueChange={value => {
                    setVatClaimFrequency(value as VatClaimFrequency)
                    markDirty()
                  }}
                >
                  <SelectTrigger id='vatClaimFrequency'>
                    <SelectValue placeholder='Select claim frequency' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='ANNUAL'>Annual</SelectItem>
                    <SelectItem value='QUARTERLY'>Quarterly</SelectItem>
                    <SelectItem value='MONTHLY'>Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className='bg-muted text-muted-foreground rounded-lg p-4 text-sm'>
                {vatStatus === 'REGISTERED'
                  ? 'VAT will be handled through regular VAT returns.'
                  : 'VAT will be treated as recoverable through VAT126 claims.'}
              </div>
            </>
          )}

          {!canRecoverVat && (
            <div className='bg-muted text-muted-foreground rounded-lg p-4 text-sm'>
              VAT recovery will be disabled. VAT amounts will be treated as part
              of the gross cost unless changed later.
            </div>
          )}
        </CardContent>
      </Card>

      {saved && !isDirty && (
        <div className='rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700'>
          Changes saved.
        </div>
      )}

      <SubmitButton label={submitLabel} isDirty={isDirty} saved={saved} />
    </form>
  )
}
