// src/app/(site)/ledger/bank-entry/new/_components/invoice-upload.tsx
'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { deleteUploadedFileAction } from '../actions'

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
  const [isUploading, setIsUploading] = useState(false)

  return (
    <div className='rounded-lg border bg-white p-2'>
      <div className='flex items-center justify-between gap-2'>
        <div className='min-w-0 flex-1'>
          {value ? (
            <a
              href={value.url}
              target='_blank'
              rel='noreferrer'
              title={value.name}
              className='block truncate text-sm text-blue-600 hover:underline'
            >
              {value.name}
            </a>
          ) : (
            <p className='text-sm text-slate-500'>Optional PDF</p>
          )}
        </div>

        {isUploading && (
          <Loader2 className='h-4 w-4 shrink-0 animate-spin text-slate-500' />
        )}

        {value && (
          <button
            type='button'
            disabled={isUploading}
            onClick={async () => {
              if (value?.key) {
                try {
                  await deleteUploadedFileAction(value.key)
                } catch {
                  toast.error('Could not remove file')
                  return
                }
              }

              onChange(null)

              toast.success('File removed')
            }}
            className='shrink-0 rounded-md border px-3 py-2 text-sm hover:bg-emerald-50/40 disabled:opacity-50'
          >
            Remove
          </button>
        )}

        <UploadButton
          endpoint='invoicePdfUploader'
          onUploadBegin={() => {
            setIsUploading(true)
          }}
          onClientUploadComplete={files => {
            const file = files[0]

            setIsUploading(false)

            if (!file) return

            onChange({
              url: file.ufsUrl,
              name: file.name,
              key: file.key
            })

            toast.success('PDF uploaded')
          }}
          onUploadError={error => {
            setIsUploading(false)
            toast.error(error.message || 'Upload failed')
          }}
          appearance={{
            button:
              'shrink-0 rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white',
            allowedContent: 'hidden'
          }}
          content={{
            button: isUploading
              ? 'Uploading...'
              : value
                ? 'Replace PDF'
                : 'Upload PDF'
          }}
        />
      </div>
    </div>
  )
}
