'use client'

import { useFormStatus } from 'react-dom'

type PendingSubmitButtonProps = {
  idleLabel: string
  pendingLabel: string
  disabled?: boolean
  className?: string
}

export function PendingSubmitButton({
  idleLabel,
  pendingLabel,
  disabled = false,
  className
}: PendingSubmitButtonProps) {
  const { pending } = useFormStatus()

  return (
    <button
      type='submit'
      disabled={disabled || pending}
      className={className}
    >
      {pending ? pendingLabel : idleLabel}
    </button>
  )
}
