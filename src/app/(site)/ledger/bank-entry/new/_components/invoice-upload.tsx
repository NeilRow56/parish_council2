// src/app/(site)/ledger/bank-entry/new/_components/invoice-upload.tsx
'use client'

import { toast } from 'sonner'

import { UploadButton } from '@/lib/uploadthing'

type UploadedInvoice = {
  url: string
  name: string
  key: string
}

export function InvoiceUpload({
  value,
  onChange
}: {
  value: UploadedInvoice | null
  onChange: (value: UploadedInvoice | null) => void
}) {
  return (
    <div className='rounded-lg border bg-white p-3'>
      <div className='flex items-center justify-between gap-3'>
        <div className='min-w-0'>
          <p className='text-sm font-medium'>Supporting document</p>

          {value ? (
            <a
              href={value.url}
              target='_blank'
              rel='noreferrer'
              className='mt-1 block truncate text-sm text-blue-600 hover:underline'
            >
              {value.name}
            </a>
          ) : (
            <p className='mt-1 text-sm text-slate-500'>
              Optional PDF invoice or receipt.
            </p>
          )}
        </div>

        <div className='flex shrink-0 items-center gap-2'>
          {value && (
            <button
              type='button'
              onClick={() => onChange(null)}
              className='rounded-md border px-3 py-2 text-sm hover:bg-slate-50'
            >
              Remove
            </button>
          )}

          <UploadButton
            endpoint='invoicePdfUploader'
            onClientUploadComplete={files => {
              const file = files[0]

              if (!file) return

              onChange({
                url: file.url,
                name: file.name,
                key: file.key
              })

              toast.success('PDF uploaded')
            }}
            onUploadError={error => {
              toast.error(error.message || 'Upload failed')
            }}
            appearance={{
              button:
                'rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white',
              allowedContent: 'hidden'
            }}
            content={{
              button: value ? 'Replace PDF' : 'Upload PDF'
            }}
          />
        </div>
      </div>
    </div>
  )
}
