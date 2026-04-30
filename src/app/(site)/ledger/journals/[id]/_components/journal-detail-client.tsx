'use client'

import { useState } from 'react'
import { Edit2 } from 'lucide-react'

import { EditJournalForm } from './edit-journal-form'

type Journal = {
  id: string
  description: string
}

type JournalLine = {
  id: string
  nominalCode: string
  nominalName: string
  description: string | null
  debit: string | number | null
  credit: string | number | null
}

export function JournalDetailClient({
  journal,
  lines
}: {
  journal: Journal
  lines: JournalLine[]
}) {
  const [isEditing, setIsEditing] = useState(false)

  if (isEditing) {
    return (
      <EditJournalForm
        journalEntryId={journal.id}
        description={journal.description}
        lines={lines}
      />
    )
  }

  return (
    <div className='flex justify-end space-y-2'>
      <button
        onClick={() => setIsEditing(true)}
        className='inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-zinc-50'
      >
        <Edit2 className='h-4 w-4' />
        Edit journal description
      </button>
    </div>
  )
}
